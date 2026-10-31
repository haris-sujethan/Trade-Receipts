"""pump.fun and PumpSwap events, decoded and normalized into launches, trades and graduations.

Both programs emit events with Anchor's `emit_cpi!`: an inner instruction to the program
itself whose data is EVENT_IX_TAG, the event's 8-byte discriminator, then the Borsh payload.
Events carry everything the pipeline needs (amounts, reserves, the trader), so trades are read
from events rather than from the many buy and sell instruction versions.

Checked against live transactions (Oct 31, 2026):
- bonding-curve TradeEvent reserves are after the trade;
- PumpSwap Buy/SellEvent pool reserves are before the trade;
- native SOL is named as the quote with the System program's id;
- Mayhem mode tokens are traded by pump.fun's own agent program, pay no fees, and have their
  curve's virtual reserves reset between trades, so their reserves break the constant product.
"""

from dataclasses import dataclass

from receipts.crypto import idl, programs

EVENT_IX_TAG = bytes.fromhex("e445a52e51cb9a1d")  # Anchor's u64 tag: sha256("anchor:event")[:8], byte-reversed


@dataclass(frozen=True)
class Context:
    """Where an event sits on chain."""

    signature: str
    slot: int
    block_time: int  # unix seconds
    index: int  # order of the event within its transaction


@dataclass(frozen=True)
class Launch:
    mint: str
    creator: str
    user: str  # the wallet that sent the create transaction
    name: str
    symbol: str
    uri: str
    bonding_curve: str
    quote_mint: str
    token_program: str | None
    total_supply: int
    virtual_token_reserves: int
    virtual_quote_reserves: int
    is_mayhem_mode: bool | None
    is_cashback_enabled: bool | None
    is_holder_reward: bool | None
    depth: int | None
    ctx: Context


@dataclass(frozen=True)
class Trade:
    venue: str  # "curve" or "pumpswap"
    mint: str | None  # None for PumpSwap until the pool is resolved to its token
    pool: str | None
    wallet: str
    is_buy: bool
    token_amount: int  # raw units (6 decimals for pump tokens)
    quote_amount: int  # raw quote units moved through the curve or pool, before fees
    quote_mint: str | None  # None for PumpSwap until the pool is resolved
    fee: int  # protocol, creator and LP fees, in quote units
    token_reserves: int  # after the trade
    quote_reserves: int  # after the trade, including virtual reserves
    ix_name: str | None
    mayhem_mode: bool | None  # a Mayhem mode token's curve; None on PumpSwap and in older events
    ctx: Context

    def price(self, quote_decimals: int) -> float:
        """Spot price after the trade, in whole quote units per whole token."""
        if not self.token_reserves:
            return float("nan")
        scale = 10 ** (programs.PUMP_TOKEN_DECIMALS - quote_decimals)
        return self.quote_reserves / self.token_reserves * scale


@dataclass(frozen=True)
class Graduation:
    """The bonding curve filled (CompleteEvent)."""

    mint: str
    bonding_curve: str
    user: str
    quote_mint: str
    ctx: Context


@dataclass(frozen=True)
class Migration:
    """The curve's liquidity moved into the token's canonical PumpSwap pool."""

    mint: str
    pool: str
    bonding_curve: str
    token_amount: int
    quote_amount: int
    pool_migration_fee: int
    ctx: Context


@dataclass(frozen=True)
class Pool:
    """A PumpSwap pool was created (by a migration or by anyone)."""

    pool: str
    base_mint: str
    quote_mint: str
    creator: str
    coin_creator: str | None
    base_amount: int
    quote_amount: int
    ctx: Context


Record = Launch | Trade | Graduation | Migration | Pool


def decode_event(program_id: str, data: bytes) -> tuple[str, dict] | None:
    """Decode a self-CPI event from inner-instruction data, or None if it isn't one."""
    if program_id not in idl.FILES or data[:8] != EVENT_IX_TAG:
        return None
    spec = idl.load(program_id)
    name = spec.events.get(data[8:16])
    if name is None:
        return None
    return name, spec.decode_struct(name, data[16:])


def decode(program_id: str, data: bytes, ctx: Context) -> Record | None:
    """Decode one inner instruction into a normalized record, or None if it isn't one we keep."""
    event = decode_event(program_id, data)
    if event is None:
        return None
    name, e = event
    build = _BUILDERS.get((program_id, name))
    return build(e, ctx) if build else None


def _quote(mint: str | None) -> str:
    # Events from before quote mints existed are SOL-quoted.
    return programs.WSOL if mint in (None, programs.NATIVE_SOL_QUOTE) else mint


def _first(*values):
    return next((v for v in values if v is not None), None)


def _launch(e: dict, ctx: Context) -> Launch:
    return Launch(
        mint=e["mint"],
        creator=e["creator"],
        user=e["user"],
        name=e["name"],
        symbol=e["symbol"],
        uri=e["uri"],
        bonding_curve=e["bonding_curve"],
        quote_mint=_quote(e.get("quote_mint")),
        token_program=e.get("token_program"),
        total_supply=e["token_total_supply"],
        virtual_token_reserves=e["virtual_token_reserves"],
        virtual_quote_reserves=_first(e.get("virtual_quote_reserves"), e["virtual_sol_reserves"]),
        is_mayhem_mode=e.get("is_mayhem_mode"),
        is_cashback_enabled=e.get("is_cashback_enabled"),
        is_holder_reward=e.get("is_holder_reward"),
        depth=e.get("depth"),
        ctx=ctx,
    )


def _curve_trade(e: dict, ctx: Context) -> Trade:
    return Trade(
        venue="curve",
        mint=e["mint"],
        pool=None,
        wallet=e["user"],
        is_buy=e["is_buy"],
        token_amount=e["token_amount"],
        quote_amount=_first(e.get("quote_amount"), e["sol_amount"]),
        quote_mint=_quote(e.get("quote_mint")),
        fee=(e.get("fee") or 0) + (e.get("creator_fee") or 0),
        token_reserves=e["virtual_token_reserves"],
        quote_reserves=_first(e.get("virtual_quote_reserves"), e["virtual_sol_reserves"]),
        ix_name=e.get("ix_name"),
        mayhem_mode=e.get("mayhem_mode"),
        ctx=ctx,
    )


def _pumpswap_trade(e: dict, ctx: Context, is_buy: bool) -> Trade:
    virtual_quote = e.get("virtual_quote_reserves") or 0
    if is_buy:
        token_amount, quote_amount = e["base_amount_out"], e["quote_amount_in"]
        token_after = e["pool_base_token_reserves"] - token_amount
        quote_after = e["pool_quote_token_reserves"] + quote_amount
    else:
        token_amount, quote_amount = e["base_amount_in"], e["quote_amount_out"]
        token_after = e["pool_base_token_reserves"] + token_amount
        quote_after = e["pool_quote_token_reserves"] - quote_amount
    return Trade(
        venue="pumpswap",
        mint=None,
        pool=e["pool"],
        wallet=e["user"],
        is_buy=is_buy,
        token_amount=token_amount,
        quote_amount=quote_amount,
        quote_mint=None,
        fee=e["lp_fee"] + e["protocol_fee"] + (e.get("coin_creator_fee") or 0),
        token_reserves=token_after,
        quote_reserves=quote_after + virtual_quote,
        ix_name=e.get("ix_name"),
        mayhem_mode=None,
        ctx=ctx,
    )


def _graduation(e: dict, ctx: Context) -> Graduation:
    return Graduation(
        mint=e["mint"], bonding_curve=e["bonding_curve"], user=e["user"],
        quote_mint=_quote(e.get("quote_mint")), ctx=ctx,
    )


def _migration(e: dict, ctx: Context) -> Migration:
    return Migration(
        mint=e["mint"], pool=e["pool"], bonding_curve=e["bonding_curve"],
        token_amount=e["mint_amount"], quote_amount=e["sol_amount"],
        pool_migration_fee=e["pool_migration_fee"], ctx=ctx,
    )


def _pool(e: dict, ctx: Context) -> Pool:
    return Pool(
        pool=e["pool"], base_mint=e["base_mint"], quote_mint=_quote(e["quote_mint"]),
        creator=e["creator"], coin_creator=e.get("coin_creator"),
        base_amount=e["base_amount_in"], quote_amount=e["quote_amount_in"], ctx=ctx,
    )


_BUILDERS = {
    (programs.PUMP, "CreateEvent"): _launch,
    (programs.PUMP, "TradeEvent"): _curve_trade,
    (programs.PUMP, "CompleteEvent"): _graduation,
    (programs.PUMP, "CompletePumpAmmMigrationEvent"): _migration,
    (programs.PUMP_AMM, "BuyEvent"): lambda e, ctx: _pumpswap_trade(e, ctx, is_buy=True),
    (programs.PUMP_AMM, "SellEvent"): lambda e, ctx: _pumpswap_trade(e, ctx, is_buy=False),
    (programs.PUMP_AMM, "CreatePoolEvent"): _pool,
}
