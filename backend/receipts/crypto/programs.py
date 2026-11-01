"""Solana program ids and mints the pipeline knows by address."""

PUMP = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P"
PUMP_AMM = "pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA"

SYSTEM = "11111111111111111111111111111111"
TOKEN = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
TOKEN_2022 = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"

WSOL = "So11111111111111111111111111111111111111112"
USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
# pump.fun's TradeEvent names native SOL as the quote with the System program's id.
NATIVE_SOL_QUOTE = SYSTEM

# pump.fun tokens are minted with 6 decimals and a 1B supply.
PUMP_TOKEN_DECIMALS = 6
QUOTE_DECIMALS = {WSOL: 9, USDC: 6}
# A pump token quoted in another pump token (create_v2 depth > 0).
DEFAULT_QUOTE_DECIMALS = PUMP_TOKEN_DECIMALS

# pump.fun's agent wallet that trades Mayhem mode tokens (most of their trades in May, Aug and Sep).
MAYHEM_AGENT = "BwWK17cbHxwWBKZkUYvzxLcNQ1YVyaFezduWbtm2de6s"

# Every pump.fun token: 1B supply. The bonding curve starts at 1,073M virtual tokens and graduates
# when its 793.1M real tokens are sold.
TOTAL_SUPPLY = 1_000_000_000 * 10**PUMP_TOKEN_DECIMALS
CURVE_START_TOKENS = 1_073_000_000 * 10**PUMP_TOKEN_DECIMALS
CURVE_SALE_TOKENS = 793_100_000 * 10**PUMP_TOKEN_DECIMALS
