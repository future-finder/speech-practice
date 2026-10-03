import json
import os
import secrets
import socket
import sys
import uvicorn


def main():
    if "--worker" in sys.argv:
        from speech_practice.worker import main as worker
        worker()
        return
    os.environ.setdefault("SPEECH_TOKEN", secrets.token_hex(32))
    from speech_practice.app import create_app
    listener = socket.socket()
    listener.bind(("127.0.0.1", int(os.environ.get("SPEECH_PORT", "0"))))
    listener.listen(128)
    listener.setblocking(False)
    print(json.dumps({"port": listener.getsockname()[1], "token": os.environ["SPEECH_TOKEN"]}), flush=True)
    config = uvicorn.Config(create_app(), log_level="warning", access_log=False)
    uvicorn.Server(config).run(sockets=[listener])


if __name__ == "__main__":
    main()
