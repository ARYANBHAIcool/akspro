#!/usr/bin/env python3
"""
AryanStreams Global Sports Scraper & Aggregator (Python Engine)
Scrapes & normalizes live sports from:
- SonyLiv Events
- FanCode Events
- Tapmad Sports
- Sonu Sports Network (Cricket & Football)
- Trendy48 Matches
- Primary Mirrors

Output: data/Sports_data.json
"""

import os
import re
import json
import datetime
from concurrent.futures import ThreadPoolExecutor
import requests

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    'Accept': 'application/json'
}

def sanitize_stream_url(url):
    if not url or not isinstance(url, str):
        return url
    if '.live.fly.ww.aiv-cdn.net' in url:
        return url.replace('.live.fly.ww.aiv-cdn.net', '.cache.aiv-cdn.net')
    return url

def parse_kid_key(api):
    if not api or not isinstance(api, str):
        return '', ''
    parts = api.split(':')
    if len(parts) == 2:
        return parts[0].strip(), parts[1].strip()
    return '', ''

def fetch_json(url, timeout=7):
    try:
        r = requests.get(url, headers=HEADERS, timeout=timeout)
        if r.status_code == 200:
            return r.json()
    except Exception:
        pass
    return None

def normalize_key(title, team_a='', team_b=''):
    if team_a and team_b:
        return ' vs '.join(sorted([team_a.strip().lower(), team_b.strip().lower()]))
    clean = re.sub(r'\s+-\s+\d{1,2}\s+[a-z]{3}\s+\d{4}.*$', '', str(title or ''), flags=re.I)
    clean = re.sub(r'\[[a-z]{2,4}\]', '', clean, flags=re.I)
    clean = re.sub(r'\(.*?\)', '', clean).strip().lower()
    parts = re.split(r'\s+(?:vs|v)\s+', clean, flags=re.I)
    if len(parts) >= 2:
        return ' vs '.join(sorted([parts[0].strip(), parts[1].strip()]))
    return clean

def run_scraper():
    print("[AryanStreams Scraper] Fetching all upstream sports feeds in parallel...")
    urls = {
        'primary': 'https://raw.githubusercontent.com/sm-monirulislam/Upcoming-and-Live-Sports-Data/main/Sports_data.json',
        'sonyliv': 'https://raw.githubusercontent.com/sm-monirulislam/SonyLiv_Event_Playlist/main/sonyLiv_data.json',
        'fancode': 'https://raw.githubusercontent.com/drmlive/fancode-live-events/main/fancode.json',
        'tapmad': 'https://raw.githubusercontent.com/sm-monirulislam/Tapmad_Auto_Update_Playlist/main/tapmad_data.json',
        'sonu_fb': 'https://sonujson-v6.pages.dev/Data/events/football.json',
        'sonu_cric': 'https://sonujson-v6.pages.dev/Data/events/cricket.json',
        'trendy': 'https://trendy48.online/api/matches/all-today'
    }

    results = {}
    with ThreadPoolExecutor(max_workers=7) as executor:
        futures = {executor.submit(fetch_json, u): k for k, u in urls.items()}
        for f in futures:
            key = futures[f]
            results[key] = f.result()

    matches_map = {}

    def get_or_create_match(norm_key, base):
        if norm_key not in matches_map:
            matches_map[norm_key] = {
                'event_name': base.get('event_name', ''),
                'Category': base.get('Category', 'Other'),
                'status': base.get('status', 'upcoming'),
                'start_time': base.get('start_time', ''),
                'eventInfo': {
                    'eventName': base.get('eventInfo', {}).get('eventName') or base.get('event_name', ''),
                    'teamA': base.get('eventInfo', {}).get('teamA', ''),
                    'teamB': base.get('eventInfo', {}).get('teamB', ''),
                    'teamAFlag': base.get('eventInfo', {}).get('teamAFlag', ''),
                    'teamBFlag': base.get('eventInfo', {}).get('teamBFlag', ''),
                    'logo': base.get('eventInfo', {}).get('logo', '')
                },
                'streams': []
            }
        m = matches_map[norm_key]
        if str(base.get('status', '')).lower() == 'live':
            m['status'] = 'live'
        return m

    def add_stream(m, s):
        if not s or not s.get('stream_url'):
            return
        url = sanitize_stream_url(s['stream_url'])
        if any(existing.get('stream_url') == url for existing in m['streams']):
            return
        m['streams'].append({
            'channel_name': s.get('channel_name') or f"Server {len(m['streams']) + 1}",
            'stream_url': url,
            'kid': s.get('kid', ''),
            'key': s.get('key', '')
        })

    # Ingest primary mirror
    primary = results.get('primary')
    if primary and isinstance(primary.get('matches'), list):
        for item in primary['matches']:
            if not item.get('event_name'):
                continue
            k = normalize_key(item['event_name'], item.get('eventInfo', {}).get('teamA'), item.get('eventInfo', {}).get('teamB'))
            m = get_or_create_match(k, item)
            for st in item.get('streams', []):
                add_stream(m, st)

    # Ingest SonyLiv
    sony = results.get('sonyliv')
    if sony and isinstance(sony.get('matches'), list):
        for item in sony['matches']:
            t = item.get('match_name', '')
            if not t:
                continue
            clean = re.sub(r'\s+-\s+\d{1,2}\s+[a-z]{3}\s+\d{4}.*$', '', t, flags=re.I).strip()
            parts = re.split(r'\s+(?:vs|v)\s+', clean, flags=re.I)
            t_a = parts[0] if len(parts) > 0 else ''
            t_b = parts[1] if len(parts) > 1 else ''
            k = normalize_key(clean, t_a, t_b)
            m = get_or_create_match(k, {
                'event_name': clean,
                'Category': item.get('event_category', 'Cricket'),
                'status': 'live' if str(item.get('status')).lower() == 'live' else 'upcoming',
                'eventInfo': {'eventName': clean, 'teamA': t_a, 'teamB': t_b, 'logo': item.get('src', '')}
            })
            if item.get('stream_link'):
                add_stream(m, {
                    'channel_name': f"{item.get('broadcast_channel', 'SonyLiv')} ({item.get('audioLanguageName', 'HD')})",
                    'stream_url': item['stream_link']
                })

    # Ingest FanCode
    fc = results.get('fancode')
    if fc and isinstance(fc.get('matches'), list):
        for item in fc['matches']:
            t = item.get('match_name', '')
            if not t:
                continue
            k = normalize_key(t, item.get('team_1'), item.get('team_2'))
            get_or_create_match(k, {
                'event_name': t,
                'Category': item.get('event_category', 'Cricket'),
                'status': 'live' if str(item.get('status')).upper() == 'LIVE' else 'upcoming',
                'start_time': item.get('startTime', ''),
                'eventInfo': {'eventName': t, 'teamA': item.get('team_1', ''), 'teamB': item.get('team_2', ''), 'logo': item.get('src', '')}
            })

    # Ingest Sonu Cricket & Football
    for cat_name, key_name in [('Cricket', 'sonu_cric'), ('Football', 'sonu_fb')]:
        sonu_obj = results.get(key_name)
        if sonu_obj and isinstance(sonu_obj.get('events'), list):
            for ev in sonu_obj['events']:
                t = ev.get('title', '')
                if not t:
                    continue
                ev_obj = ev.get('event', {})
                k = normalize_key(t, ev_obj.get('teamA'), ev_obj.get('teamB'))
                is_live = ev.get('status') == 'live'
                m = get_or_create_match(k, {
                    'event_name': t,
                    'Category': ev.get('cat') or ev_obj.get('category') or cat_name,
                    'status': 'live' if is_live else 'upcoming',
                    'start_time': ev_obj.get('startTimeIST', ''),
                    'eventInfo': {
                        'eventName': t,
                        'teamA': ev_obj.get('teamA', ''),
                        'teamB': ev_obj.get('teamB', ''),
                        'teamAFlag': ev_obj.get('teamAFlag', ''),
                        'teamBFlag': ev_obj.get('teamBFlag', ''),
                        'logo': ev_obj.get('logo', '')
                    }
                })
                for s in ev.get('streams', []):
                    kid, dec_key = parse_kid_key(s.get('api'))
                    add_stream(m, {
                        'channel_name': s.get('title') or f"Server {len(m['streams']) + 1}",
                        'stream_url': s.get('link') or s.get('url'),
                        'kid': kid or s.get('kid', ''),
                        'key': dec_key or s.get('key', '')
                    })

    all_matches = list(matches_map.values())
    live_count = sum(1 for m in all_matches if str(m.get('status')).lower() == 'live')
    now = datetime.datetime.now()

    payload = {
        'name': 'AryanStreams Master Sports Feed',
        'owner': 'AryanStreams Global',
        'last_update_time': now.strftime('%I:%M:%S %p %d-%m-%Y'),
        'total_matches': len(all_matches),
        'live_match': live_count,
        'matches': all_matches
    }

    out_dir = os.path.join(os.path.dirname(__file__), '..', 'data')
    os.makedirs(out_dir, exist_ok=True)
    out_file = os.path.join(out_dir, 'Sports_data.json')
    with open(out_file, 'w', encoding='utf-8') as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)

    print(f"[AryanStreams Python Scraper] Compiled {len(all_matches)} matches ({live_count} live) to {out_file}")

if __name__ == '__main__':
    run_scraper()
