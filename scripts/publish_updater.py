import json, urllib.request, urllib.error, os, sys
from datetime import datetime, timezone

TOKEN   = os.environ['GITHUB_TOKEN']
TAG     = os.environ['CIRCLE_TAG']
OWNER   = 'Drodo44'
REPO    = 'Drodo.io'

with open('src-tauri/tauri.conf.json') as f:
    VERSION = json.load(f)['version']

def gh(path, method='GET', data=None, content_type='application/json', accept='application/vnd.github+json'):
    req = urllib.request.Request(
        f'https://api.github.com{path}',
        method=method, data=data,
        headers={'Authorization': f'Bearer {TOKEN}', 'Accept': accept,
                 'Content-Type': content_type})
    with urllib.request.urlopen(req) as r:
        return json.load(r)

release    = gh(f'/repos/{OWNER}/{REPO}/releases/tags/{TAG}')
release_id = release['id']
assets     = {a['name']: a for a in release['assets']}

def download_sig(name):
    if name not in assets:
        print(f'ERROR: {name} not found in release assets', file=sys.stderr)
        sys.exit(1)
    asset_id = assets[name]['id']
    req = urllib.request.Request(
        f'https://api.github.com/repos/{OWNER}/{REPO}/releases/assets/{asset_id}',
        headers={'Authorization': f'Bearer {TOKEN}', 'Accept': 'application/octet-stream'})
    with urllib.request.urlopen(req) as r:
        return r.read().decode('utf-8').strip()

win_sig   = download_sig(f'Drodo_{VERSION}_x64-setup.exe.sig')
linux_sig = download_sig(f'Drodo_{VERSION}_amd64.AppImage.sig')

manifest = {
    'version':  VERSION,
    'notes':    'Bug fixes and improvements',
    'pub_date': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
    'platforms': {
        'windows-x86_64': {
            'signature': win_sig,
            'url': f'https://github.com/{OWNER}/{REPO}/releases/download/{TAG}/Drodo_{VERSION}_x64-setup.exe',
        },
        'linux-x86_64': {
            'signature': linux_sig,
            'url': f'https://github.com/{OWNER}/{REPO}/releases/download/{TAG}/Drodo_{VERSION}_amd64.AppImage',
        },
    },
}
body = json.dumps(manifest, indent=2).encode('utf-8')
print(body.decode())

# Delete existing latest.json asset if present
if 'latest.json' in assets:
    existing_id = assets['latest.json']['id']
    req = urllib.request.Request(
        f'https://api.github.com/repos/{OWNER}/{REPO}/releases/assets/{existing_id}',
        method='DELETE',
        headers={'Authorization': f'Bearer {TOKEN}', 'Accept': 'application/vnd.github+json'}
    )
    try:
        urllib.request.urlopen(req)
        print('Deleted existing latest.json asset')
    except urllib.error.HTTPError as e:
        print(f'Warning: could not delete existing latest.json: {e.code}', file=sys.stderr)

upload_url = (f'https://uploads.github.com/repos/{OWNER}/{REPO}'
              f'/releases/{release_id}/assets?name=latest.json')
req = urllib.request.Request(upload_url, method='POST', data=body,
    headers={'Authorization': f'Bearer {TOKEN}',
             'Accept': 'application/vnd.github+json',
             'Content-Type': 'application/json'})
try:
    with urllib.request.urlopen(req) as r:
        result = json.load(r)
        print(f"Uploaded: {result['browser_download_url']}")
except urllib.error.HTTPError as e:
    print(f'Upload failed: {e.code} {e.read().decode()}', file=sys.stderr)
    sys.exit(1)
