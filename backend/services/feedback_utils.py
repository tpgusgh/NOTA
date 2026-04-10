from typing import Tuple


def parse_feedback_sections(raw_text: str) -> Tuple[str, str, str]:
    missing = ''
    suggestions = ''
    positives = ''

    headings = [
        ('누락 항목', 'missing'),
        ('보완 제안', 'suggestions'),
        ('잘한 점', 'positives'),
    ]

    index_map = {}
    for title, key in headings:
        idx = raw_text.find(title)
        if idx != -1:
            index_map[key] = idx

    ordered = sorted(index_map.items(), key=lambda item: item[1])
    for i, (key, start) in enumerate(ordered):
        end = ordered[i + 1][1] if i + 1 < len(ordered) else len(raw_text)
        section_text = raw_text[start:end].strip()
        if key == 'missing':
            missing = section_text
        elif key == 'suggestions':
            suggestions = section_text
        elif key == 'positives':
            positives = section_text

    if not (missing or suggestions or positives):
        return ('누락 항목 정보를 찾을 수 없습니다.', '보완 제안 정보를 찾을 수 없습니다.', '잘한 점 정보를 찾을 수 없습니다.')

    return (missing, suggestions, positives)
