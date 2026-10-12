#!/usr/bin/env python3
"""Remove InsightBook SRS from the end-4 ii bar, preserving private data."""
import argparse
from pathlib import Path

from install import uninstall


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--shell", type=Path, default=Path.home() / ".config/quickshell/ii")
    args = parser.parse_args()
    uninstall(args.shell)


if __name__ == "__main__":
    main()
