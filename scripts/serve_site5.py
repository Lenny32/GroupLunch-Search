import argparse
import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser(description="Serve the local 5-page test site")
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()

    root = Path(__file__).resolve().parents[1] / "tests" / "fixtures" / "site5"
    os.chdir(root)

    server = ThreadingHTTPServer(("0.0.0.0", args.port), SimpleHTTPRequestHandler)
    url = f"http://127.0.0.1:{args.port}/index.html"
    print(f"Serving {root} at {url}")
    print("Press Ctrl+C to stop.")
    server.serve_forever()


if __name__ == "__main__":
    main()
