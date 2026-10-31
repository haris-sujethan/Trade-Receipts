"""Borsh decoding and encoding driven by an Anchor IDL (the 0.30+ format pump.fun publishes).

pump.fun appends fields to its events over time, so an event from May is shorter than the
current IDL says. Decoding stops at the last complete field and leaves the rest as None.
"""

import struct

import base58

_INTS = {
    "u8": "<B", "i8": "<b", "u16": "<H", "i16": "<h", "u32": "<I", "i32": "<i",
    "u64": "<Q", "i64": "<q", "f32": "<f", "f64": "<d",
}


class Truncated(ValueError):
    """The data ended partway through a value."""


class _Reader:
    def __init__(self, data: bytes):
        self.data = data
        self.pos = 0

    def take(self, n: int) -> bytes:
        end = self.pos + n
        if end > len(self.data):
            raise Truncated(f"needed {n} bytes at {self.pos}, have {len(self.data) - self.pos}")
        chunk = self.data[self.pos:end]
        self.pos = end
        return chunk

    @property
    def done(self) -> bool:
        return self.pos >= len(self.data)


class Idl:
    def __init__(self, raw: dict):
        self.address: str = raw["address"]
        self.types: dict[str, dict] = {t["name"]: t["type"] for t in raw.get("types", [])}
        self.events: dict[bytes, str] = {bytes(e["discriminator"]): e["name"] for e in raw.get("events", [])}
        self.event_discriminators: dict[str, bytes] = {name: disc for disc, name in self.events.items()}
        self.instructions: dict[bytes, dict] = {bytes(i["discriminator"]): i for i in raw["instructions"]}

    # Decoding

    def decode_struct(self, name: str, data: bytes) -> dict:
        """Decode a named struct, tolerating data that ends early at a field boundary."""
        reader = _Reader(data)
        fields = self.types[name]["fields"]
        out: dict = {}
        for field in fields:
            if reader.done:
                out[field["name"]] = None
                continue
            out[field["name"]] = self._read(field["type"], reader)
        return out

    def _read(self, ty, r: _Reader):
        if isinstance(ty, str):
            if ty in _INTS:
                fmt = _INTS[ty]
                return struct.unpack(fmt, r.take(struct.calcsize(fmt)))[0]
            if ty in ("u128", "i128"):
                return int.from_bytes(r.take(16), "little", signed=ty == "i128")
            if ty == "bool":
                return r.take(1) != b"\x00"
            if ty == "pubkey":
                return base58.b58encode(r.take(32)).decode()
            if ty == "string":
                (n,) = struct.unpack("<I", r.take(4))
                return r.take(n).decode("utf-8", errors="replace")
            if ty == "bytes":
                (n,) = struct.unpack("<I", r.take(4))
                return r.take(n)
            raise ValueError(f"unsupported IDL type {ty!r}")
        if "vec" in ty:
            (n,) = struct.unpack("<I", r.take(4))
            return [self._read(ty["vec"], r) for _ in range(n)]
        if "option" in ty:
            return self._read(ty["option"], r) if r.take(1) != b"\x00" else None
        if "array" in ty:
            inner, n = ty["array"]
            return [self._read(inner, r) for _ in range(n)]
        if "defined" in ty:
            return self._read_defined(ty["defined"]["name"], r)
        raise ValueError(f"unsupported IDL type {ty!r}")

    def _read_defined(self, name: str, r: _Reader):
        ty = self.types[name]
        if ty["kind"] == "struct":
            return self._read_fields(ty.get("fields", []), r)
        if ty["kind"] == "enum":
            variant = ty["variants"][r.take(1)[0]]
            if not variant.get("fields"):
                return variant["name"]
            return {variant["name"]: self._read_fields(variant["fields"], r)}
        raise ValueError(f"unsupported IDL kind {ty['kind']!r}")

    def _read_fields(self, fields: list, r: _Reader):
        if fields and isinstance(fields[0], dict) and "name" in fields[0]:
            return {f["name"]: self._read(f["type"], r) for f in fields}
        return [self._read(f, r) for f in fields]

    # Encoding (used to build test events)

    def encode_struct(self, name: str, values: dict) -> bytes:
        out = bytearray()
        for field in self.types[name]["fields"]:
            if field["name"] not in values:
                break  # an older, shorter layout
            self._write(field["type"], values[field["name"]], out)
        return bytes(out)

    def _write(self, ty, value, out: bytearray) -> None:
        if isinstance(ty, str):
            if ty in _INTS:
                out += struct.pack(_INTS[ty], value)
            elif ty in ("u128", "i128"):
                out += int(value).to_bytes(16, "little", signed=ty == "i128")
            elif ty == "bool":
                out += b"\x01" if value else b"\x00"
            elif ty == "pubkey":
                raw = base58.b58decode(value)
                if len(raw) != 32:
                    raise ValueError(f"pubkey {value!r} is not 32 bytes")
                out += raw
            elif ty == "string":
                raw = value.encode()
                out += struct.pack("<I", len(raw)) + raw
            elif ty == "bytes":
                out += struct.pack("<I", len(value)) + value
            else:
                raise ValueError(f"unsupported IDL type {ty!r}")
        elif "vec" in ty:
            out += struct.pack("<I", len(value))
            for item in value:
                self._write(ty["vec"], item, out)
        elif "option" in ty:
            if value is None:
                out += b"\x00"
            else:
                out += b"\x01"
                self._write(ty["option"], value, out)
        elif "array" in ty:
            for item in value:
                self._write(ty["array"][0], item, out)
        elif "defined" in ty:
            defined = self.types[ty["defined"]["name"]]
            if defined["kind"] != "struct":
                raise ValueError("encoding enums isn't needed yet")
            for field in defined["fields"]:
                self._write(field["type"], value[field["name"]], out)
        else:
            raise ValueError(f"unsupported IDL type {ty!r}")
