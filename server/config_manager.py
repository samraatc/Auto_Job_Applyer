import os
import re

CONFIG_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'config')

def read_config(filename):
    filepath = os.path.join(CONFIG_DIR, filename)
    if not os.path.exists(filepath):
        return {}

    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Use a single namespace for globals + locals so functions defined inside
    # the file (e.g. an _env() helper in config/secrets.py) can see other
    # module-level names like an `import os` (Python treats exec with separate
    # globals/locals like an inner function, which would otherwise miss them).
    ns = {}
    try:
        exec(content, ns, ns)
    except Exception as e:
        print(f"Error reading {filename}: {e}")

    config_data = {}
    for k, v in ns.items():
        if k.startswith('_'):
            continue
        if k == '__builtins__':
            continue
        if callable(v):
            continue
        if type(v) in (int, float, str, bool, list, dict):
            config_data[k] = v

    return config_data

def format_value(val):
    # Order matters: bool is a subclass of int, so check bool before int-via-isinstance
    # would catch it. We handle it explicitly here.
    if isinstance(val, bool):
        return str(val)
    if isinstance(val, str):
        if '\n' in val:
            return f'"""\\n{val}\\n"""'
        # To avoid breaking existing quotes if string contains "
        val_escaped = val.replace('"', '\\"')
        return f'"{val_escaped}"'
    if isinstance(val, list):
        items = [format_value(item) for item in val]
        return "[" + ", ".join(items) + "]"
    if isinstance(val, dict):
        # Emit a single-line dict so the regex writer matches the assignment cleanly.
        # We format keys and values recursively to keep escaping consistent with how
        # individual scalars are written elsewhere in this file. Nested dicts/lists
        # are supported.
        items = []
        for k, v in val.items():
            items.append(f"{format_value(k)}: {format_value(v)}")
        return "{" + ", ".join(items) + "}"
    return repr(val)

def write_config(filename, updates):
    filepath = os.path.join(CONFIG_DIR, filename)
    if not os.path.exists(filepath):
        return
        
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    for key, val in updates.items():
        val_str = format_value(val)
        
        # Regex explanation:
        # ^key\s*=\s* Matches the variable assignment
        # (?:\[.*?\]|""".*?"""|'''.*?'''|.*?) Matches arrays, triple quotes, or single lines
        # This is a bit simplified, but handles most cases.
        pattern = re.compile(rf'^({key}\s*=)\s*(?:\[[^\]]*\]|\"\"\"[\s\S]*?\"\"\"|\'\'\'[\s\S]*?\'\'\'|.*?)(?=\s*(?:#|$|\n\s*[a-zA-Z_#]))', re.MULTILINE)
        
        if pattern.search(content):
            content = pattern.sub(rf'\1 {val_str}', content, count=1)
        else:
            # Fallback for simpler single-line replacement
            simple_pattern = re.compile(rf'^{key}\s*=.*$', re.MULTILINE)
            if simple_pattern.search(content):
                content = simple_pattern.sub(f'{key} = {val_str}', content, count=1)
            else:
                content += f'\n{key} = {val_str}\n'
            
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

def get_all_configs():
    return {
        'personals': read_config('personals.py'),
        'search': read_config('search.py'),
        'settings': read_config('settings.py'),
        'questions': read_config('questions.py')
    }

def update_all_configs(payload):
    for category, updates in payload.items():
        filename = f"{category}.py"
        write_config(filename, updates)
