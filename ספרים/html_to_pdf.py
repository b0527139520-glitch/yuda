#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
html_to_pdf.py — הופך את כל קובצי ה-HTML שבתיקייה לקבצי PDF.

איך זה עובד:
    שם את הסקריפט הזה בתוך התיקייה עם קובצי ה-HTML (למשל, לצד הספרים
    שבתיקיית "ספרים"), ומריצים:

        python html_to_pdf.py

    לכל "ספר.html" ייווצר "ספר.pdf" באותה תיקייה, עם אותו שם בדיוק.

    אפשר גם לתת נתיב לתיקייה אחרת:
        python html_to_pdf.py "הנתיב/לתיקייה"

בלי שום התקנה: הסקריפט משתמש בדפדפן Chrome / Edge / Chromium שכבר מותקן
במחשב, במצב headless, ומפעיל את פקודת ההדפסה המובנית שלו ל-PDF
(--print-to-pdf). זו אותה טכניקה שבה משתמש render-cover.mjs שבסקיל
torah-html-article-v2, רק בפייתון וכללי לכל קובץ HTML בתיקייה, לא רק
לכריכות.

מכיוון שהדפדפן מדפיס את העמוד ולא מצלם אותו, כל כללי @media print
שכבר מוטמעים בקובצי הספרים (גודל A4, שוליים, הסתרת סרגל ההאזנה וכפתור
החזרה למעלה, מעבר עמוד לכל פרק וכו') חלים אוטומטית — אין צורך לשכתב
או להעתיק אותם כאן.
"""

import argparse
import os
import shutil
import subprocess
import sys
import tempfile
import urllib.parse
from pathlib import Path

# נתיבי דפדפנים נפוצים בכל מערכת הפעלה, לפי סדר עדיפות.
# אפשר גם לדרוס עם --browser או עם משתנה הסביבה HTML_TO_PDF_BROWSER.
CANDIDATE_BROWSERS = [
    os.environ.get("HTML_TO_PDF_BROWSER"),
    shutil.which("google-chrome"),
    shutil.which("google-chrome-stable"),
    shutil.which("chromium"),
    shutil.which("chromium-browser"),
    shutil.which("microsoft-edge"),
    shutil.which("msedge"),
    shutil.which("chrome"),
    "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",  # דפדפן Chromium שמגיע מובנה בסביבת claude.ai
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    str(Path(os.environ.get("LOCALAPPDATA", "")) / "Google/Chrome/Application/chrome.exe"),
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
]


def find_browser(explicit=None):
    if explicit:
        if Path(explicit).exists():
            return explicit
        sys.exit(f'❌ לא נמצא דפדפן בנתיב שסופק: "{explicit}"')
    for candidate in CANDIDATE_BROWSERS:
        if candidate and Path(candidate).exists():
            return candidate
    sys.exit(
        "❌ לא נמצא Chrome, Edge או Chromium מותקנים במחשב.\n"
        "   התקן אחד מהם, או ציין נתיב ידנית:\n"
        "     python html_to_pdf.py --browser \"הנתיב\\ל\\chrome.exe\"\n"
        "   או קבע את משתנה הסביבה HTML_TO_PDF_BROWSER."
    )


def html_to_pdf(browser, html_path: Path, pdf_path: Path, timeout: int) -> None:
    """
    מדפיס קובץ HTML בודד ל-PDF, דרך תיקייה זמנית עם שם קובץ לועזי.
    כמו ש-render-cover.mjs מעיר: כרום בווינדוס לא תמיד מעכל שמות קבצים
    בעברית שמגיעים בשורת הפקודה — הוא פשוט לא כותב את הפלט, בלי שגיאה.
    לכן העבודה בפועל נעשית על עותק זמני עם שם לועזי, והתוצאה מועתקת
    בסוף בחזרה לשם המקורי (העברי).
    """
    with tempfile.TemporaryDirectory(prefix="html2pdf-") as tmp:
        tmp_html = Path(tmp) / "in.html"
        tmp_pdf = Path(tmp) / "out.pdf"
        shutil.copyfile(html_path, tmp_html)

        file_url = "file:///" + urllib.parse.quote(str(tmp_html.resolve()).replace("\\", "/"))

        cmd = [
            browser,
            "--headless=new",
            "--disable-gpu",
            "--no-sandbox",
            "--hide-scrollbars",
            "--disable-extensions",
            "--virtual-time-budget=4000",  # זמן לגופנים ולגרדיאנטים להיטען לפני ההדפסה
            f"--print-to-pdf={tmp_pdf}",
            "--no-pdf-header-footer",
            file_url,
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)

        if not tmp_pdf.exists():
            stderr_tail = "\n".join(result.stderr.strip().splitlines()[-5:])
            raise RuntimeError(f"הדפדפן לא יצר קובץ PDF.\n{stderr_tail}")

        pdf_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(tmp_pdf, pdf_path)


def main():
    parser = argparse.ArgumentParser(
        description="הופך את כל קובצי ה-HTML שבתיקייה נתונה לקבצי PDF, בעזרת דפדפן Chrome/Edge מותקן."
    )
    parser.add_argument(
        "folder",
        nargs="?",
        default=str(Path(__file__).resolve().parent),
        help="תיקייה להמרה (ברירת מחדל: התיקייה שבה נמצא הסקריפט הזה).",
    )
    parser.add_argument("--browser", help="נתיב מפורש לדפדפן Chrome/Edge/Chromium.")
    parser.add_argument("--timeout", type=int, default=90, help="זמן קצוב לכל קובץ, בשניות (ברירת מחדל: 90).")
    args = parser.parse_args()

    folder = Path(args.folder).resolve()
    if not folder.is_dir():
        sys.exit(f'❌ התיקייה לא קיימת: "{folder}"')

    html_files = sorted(folder.glob("*.html"))
    if not html_files:
        print(f"לא נמצאו קובצי HTML בתיקייה: {folder}")
        return

    browser = find_browser(args.browser)
    print(f"דפדפן: {browser}")
    print(f"תיקייה: {folder}")
    print(f"נמצאו {len(html_files)} קובצי HTML.\n")

    ok, failed = 0, []
    for html_path in html_files:
        pdf_path = html_path.with_suffix(".pdf")
        print(f"⏳ {html_path.name}")
        try:
            html_to_pdf(browser, html_path, pdf_path, args.timeout)
            size_kb = pdf_path.stat().st_size / 1024
            print(f"✅ {pdf_path.name}  ({size_kb:.0f}KB)")
            ok += 1
        except Exception as e:
            print(f"❌ {html_path.name}: {e}")
            failed.append(html_path.name)

    print(f"\nהושלם: {ok}/{len(html_files)} הצליחו.")
    if failed:
        print("נכשלו:")
        for name in failed:
            print(f"  - {name}")
        sys.exit(1)


if __name__ == "__main__":
    main()
