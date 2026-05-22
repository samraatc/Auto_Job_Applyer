import asyncio
import os
import queue
import subprocess
import threading

BOT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')

# Three independent processes can run, one slot each.
_processes: dict[str, subprocess.Popen | None] = {"bot": None, "feed": None, "discover": None}
_queues: dict[str, queue.Queue] = {"bot": queue.Queue(), "feed": queue.Queue(), "discover": queue.Queue()}


def _enqueue_output(out, q):
    try:
        for line in iter(out.readline, ''):
            if line == '':
                break
            q.put(line)
    except Exception as e:
        q.put(f"[LOG TRACE EXCEPTION] {e}\n")
    finally:
        try:
            out.close()
        except Exception:
            pass


def _spawn(slot: str, argv: list[str]) -> dict:
    proc = _processes.get(slot)
    if proc is not None and proc.poll() is None:
        return {"status": "already_running", "slot": slot}

    with _queues[slot].mutex:
        _queues[slot].queue.clear()

    new_proc = subprocess.Popen(
        argv,
        cwd=BOT_DIR,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        bufsize=1,
        universal_newlines=True,
        encoding='utf-8',
        errors='replace',
    )
    _processes[slot] = new_proc

    t = threading.Thread(target=_enqueue_output, args=(new_proc.stdout, _queues[slot]))
    t.daemon = True
    t.start()
    return {"status": "started", "slot": slot}


def _stop(slot: str) -> dict:
    proc = _processes.get(slot)
    if proc is None or proc.poll() is not None:
        return {"status": "not_running", "slot": slot}
    proc.terminate()
    return {"status": "stopped", "slot": slot}


def _status(slot: str) -> dict:
    proc = _processes.get(slot)
    if proc is None or proc.poll() is not None:
        return {"status": "not_running", "slot": slot}
    return {"status": "running", "slot": slot}


def start_bot():
    return _spawn("bot", ['python', '-u', 'runAiBot.py'])


def stop_bot():
    return _stop("bot")


def get_status():
    return _status("bot")


def start_feed_scan(dry_run: bool = False, keywords: list[str] | None = None):
    """
    Start the feed scraper subprocess.
    - keywords=None  → original behaviour (scan configured companies)
    - keywords=[...] → keyword-based LinkedIn content search (e.g. ["hiring"])
    Both share the "feed" slot so only one scan can run at a time.
    """
    argv = ['python', '-u', '-m', 'modules.feed_scraper']
    if dry_run:
        argv.append('--dry-run')
    if keywords:
        argv.append('--keywords')
        # Argparse with nargs="*" accepts each keyword as a separate argv entry,
        # so multi-word phrases stay intact ("we are hiring devops" → one arg).
        argv.extend(keywords)
    return _spawn("feed", argv)


def stop_feed_scan():
    return _stop("feed")


def feed_status():
    return _status("feed")


def start_discovery():
    return _spawn("discover", ['python', '-u', '-m', 'modules.company_discovery'])


def discovery_status():
    return _status("discover")


async def _generic_log_generator(slot: str):
    q = _queues[slot]
    while True:
        try:
            line = q.get_nowait()
            yield f"data: {line}\n\n"
        except queue.Empty:
            proc = _processes.get(slot)
            if proc is not None and proc.poll() is None:
                await asyncio.sleep(0.1)
            else:
                yield "data: [PROCESS_TERMINATED]\n\n"
                break


async def log_generator():
    async for chunk in _generic_log_generator("bot"):
        yield chunk


async def feed_log_generator():
    async for chunk in _generic_log_generator("feed"):
        yield chunk


async def discover_log_generator():
    async for chunk in _generic_log_generator("discover"):
        yield chunk
