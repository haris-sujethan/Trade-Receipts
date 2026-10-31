"""pump.fun's public IDLs, pinned to one commit and cached under `data/idl/`.

The IDL repo (github.com/pump-fun/pump-public-docs) states no license, so the files are
fetched at runtime into the gitignored data cache instead of being committed.
"""

import json
from functools import cache

import httpx

from receipts.config import settings
from receipts.crypto import programs
from receipts.crypto.borsh import Idl

IDL_COMMIT = "639b87fb45c3adeffa6f7c4a1bf0cb85e392bf22"  # Oct 13, 2026
IDL_URL = "https://raw.githubusercontent.com/pump-fun/pump-public-docs/{commit}/idl/{name}.json"

FILES = {programs.PUMP: "pump", programs.PUMP_AMM: "pump_amm"}


def _path(name: str):
    return settings.data_dir / "idl" / IDL_COMMIT / f"{name}.json"


def fetch(name: str) -> dict:
    path = _path(name)
    if not path.exists():
        response = httpx.get(IDL_URL.format(commit=IDL_COMMIT, name=name), timeout=30, follow_redirects=True)
        response.raise_for_status()
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(response.content)
    return json.loads(path.read_text())


@cache
def load(program_id: str) -> Idl:
    idl = Idl(fetch(FILES[program_id]))
    if idl.address != program_id:
        raise ValueError(f"IDL {FILES[program_id]} is for {idl.address}, expected {program_id}")
    return idl
