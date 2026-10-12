#!/usr/bin/env python3
"""Build and optionally publish the standalone Quickshell module to Bunny Storage."""
import argparse
import hashlib
import io
import json
import os
from pathlib import Path
import re
import subprocess
import tarfile
from urllib.error import HTTPError
from urllib.parse import quote
from urllib.request import Request, urlopen

SOURCE = Path(__file__).resolve().parent
REPO = SOURCE.parents[1]


def build(output, version):
    if not re.fullmatch(r"v?\d+\.\d+\.\d+(?:[-.][A-Za-z0-9.-]+)?", version):
        raise ValueError("Invalid release version")
    output.mkdir(parents=True, exist_ok=True)
    archive = output / "quickshell-bar.tar.gz"
    files = [SOURCE / name for name in ("install.py", "uninstall.py", "bridge.py", "session.py", "README.md")]
    files += sorted(path for path in (SOURCE / "qml").iterdir() if path.is_file() and (path.suffix in (".qml", ".js") or path.name == "qmldir"))
    # Explicit allowlist: never package local settings, tokens, tests or caches.
    with tarfile.open(archive, "w:gz") as bundle:
        for path in files:
            bundle.add(path, arcname="quickshell-bar/" + path.relative_to(SOURCE).as_posix())
        data = (version + "\n").encode()
        info = tarfile.TarInfo("quickshell-bar/VERSION")
        info.size = len(data)
        info.mode = 0o644
        bundle.addfile(info, io.BytesIO(data))
    digest = hashlib.sha256(archive.read_bytes()).hexdigest()
    checksum = output / "quickshell-bar.tar.gz.sha256"
    checksum.write_text(f"{digest}  quickshell-bar.tar.gz\n")
    manifest = output / "manifest.json"
    manifest.write_text(json.dumps({"version": version, "sha256": digest, "archive": "quickshell-bar.tar.gz"}, indent=2) + "\n")
    return archive, checksum, manifest


def load_env(path):
    if path:
        for line in path.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, value = line.split("=", 1)
                os.environ.setdefault(key.strip(), value.strip().strip("\"'"))


def publish(files, version):
    zone = os.environ.get("BUNNY_STORAGE_ZONE") or os.environ.get("S3_BUCKET")
    password = os.environ.get("BUNNY_STORAGE_PASSWORD") or os.environ.get("S3_SECRET_KEY")
    if not zone or not password:
        raise ValueError("Set BUNNY_STORAGE_ZONE/BUNNY_STORAGE_PASSWORD or S3_BUCKET/S3_SECRET_KEY")
    region = os.environ.get("BUNNY_STORAGE_REGION", "").strip().lower()
    host = f"{region}.storage.bunnycdn.com" if region else "storage.bunnycdn.com"
    base = f"https://{host}/{quote(zone, safe='')}/quickshell-bar"
    endpoint = os.environ.get("S3_ENDPOINT")
    # Upload versioned files first; update latest only after all uploads succeed.
    for directory in (version, "latest"):
        for path in files:
            content_type = "application/gzip" if path.suffix == ".gz" else "application/json" if path.suffix == ".json" else "text/plain"
            if endpoint:
                credentials = dict(os.environ, AWS_ACCESS_KEY_ID=os.environ.get("S3_ACCESS_KEY", ""), AWS_SECRET_ACCESS_KEY=password, AWS_DEFAULT_REGION=os.environ.get("S3_REGION", "us-east-1"), AWS_EC2_METADATA_DISABLED="true")
                result = subprocess.run(["aws", "--endpoint-url", endpoint, "s3api", "put-object", "--bucket", zone, "--key", f"quickshell-bar/{directory}/{path.name}", "--body", str(path), "--content-type", content_type, "--cache-control", "no-cache"], env=credentials, capture_output=True)
                if result.returncode:
                    raise SystemExit(f"S3 upload failed for {directory}/{path.name} (exit {result.returncode})")
                print(f"Published quickshell-bar/{directory}/{path.name}")
                continue
            url = f"{base}/{quote(directory, safe='')}/{path.name}"
            request = Request(url, data=path.read_bytes(), method="PUT", headers={"AccessKey": password, "Content-Type": content_type})
            with urlopen(request, timeout=60) as response:
                if response.status not in (200, 201):
                    raise RuntimeError(f"Upload failed: HTTP {response.status}")
            print(f"Published quickshell-bar/{directory}/{path.name}")
    cdn = (os.environ.get("VITE_CDN_URL") or os.environ.get("CDN_URL") or "https://cdn.insight-book.ru").strip().rstrip("/")
    if not cdn.startswith("https://"):
        cdn = "https://" + cdn
    api_key = os.environ.get("BUNNY_API_KEY")
    if api_key:
        for path in files:
            url = f"{cdn}/quickshell-bar/latest/{path.name}"
            request = Request("https://api.bunny.net/purge?url=" + quote(url, safe=""), method="POST", headers={"AccessKey": api_key})
            with urlopen(request, timeout=60):
                pass
        print("Latest CDN cache cleared")
    print(f"Download: {cdn}/quickshell-bar/latest/quickshell-bar.tar.gz")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--version", default="v" + json.loads((REPO / "package.json").read_text())["version"])
    parser.add_argument("--output", type=Path, default=SOURCE / "dist")
    parser.add_argument("--env-file", type=Path)
    parser.add_argument("--publish", action="store_true")
    args = parser.parse_args()
    files = build(args.output, args.version)
    print(f"Built {files[0]} ({args.version})")
    if args.publish:
        load_env(args.env_file)
        try:
            publish(files, args.version)
        except HTTPError as error:
            raise SystemExit(f"Publication failed: HTTP {error.code}") from None


if __name__ == "__main__":
    main()
