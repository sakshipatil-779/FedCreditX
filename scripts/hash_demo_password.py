#!/usr/bin/env python3
"""
scripts/hash_demo_password.py

Utility script to generate a bcrypt hash for DEMO_AUDITOR_PASSWORD_HASH.
Reads the password securely via getpass, prints only the resulting hash to stdout,
and never writes any credentials or output to disk.
"""

import sys
import getpass
import bcrypt


def read_secret(prompt: str) -> str:
    if not sys.stdin.isatty():
        sys.stderr.write(prompt)
        sys.stderr.flush()
        line = sys.stdin.readline()
        return line.rstrip("\r\n")
    return getpass.getpass(prompt)


def main():
    try:
        password = read_secret("Enter demo auditor password: ")
        if not password:
            sys.stderr.write("Error: Password cannot be empty.\n")
            sys.exit(1)

        confirm = read_secret("Confirm demo auditor password: ")
        if password != confirm:
            sys.stderr.write("Error: Passwords do not match.\n")
            sys.exit(1)

        # Generate bcrypt hash using a secure random salt
        salt = bcrypt.gensalt(rounds=12)
        password_hash = bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

        # Output ONLY the hash string
        print(password_hash)

    except KeyboardInterrupt:
        sys.stderr.write("\nAborted.\n")
        sys.exit(1)


if __name__ == "__main__":
    main()
