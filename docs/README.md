# docs/

גיבוי מגורסן של סקילי "קול תודה". **שום דבר כאן לא נטען כסקיל.**

הסקילים החיים מותקנים ברמת החשבון ב-claude.ai (Settings → Capabilities → Skills),
והם המקור היחיד לאמת. התיקייה הזאת קיימת כדי שיהיה היסטוריית git לשינויים,
וכדי שיהיה מאיפה לבנות זיפ להעלאה.

| תיקייה | מה זה |
|---|---|
| `torah-html-article-v2/` | הסקיל המלא. מכאן בונים את הזיפ להעלאה. |
| `torah-html-article-v1-patched/` | ה-SKILL.md של v1 עם התיאור המצומצם (מופעל בשם בלבד). |
| `torah-html-article-v2-מה-אפשר-לבקש.md` | מדריך שימוש: מה קבוע, מה אפשר לבקש, מה ישבור. |

## למה זה לא ב-.claude/skills/

היה שם, והוצא בכוונה. סקיל שיושב ב-`.claude/skills/` נטען בכל סשן שרץ על
הריפו — ואז הוא **וגם** העותק שבחשבון נטענים יחד באותו שם. כל עוד הם זהים
זה לא מזיק, אבל ברגע ששינוי נכנס רק לאחד מהם הם מתפצלים בשקט, ואי אפשר לדעת
איזה מהם רץ בפועל.

## תהליך שינוי

1. ערוך כאן, ב-`docs/torah-html-article-v2/`.
2. הרץ את הבדיקות:
   ```bash
   cd docs/torah-html-article-v2 && npm install linkedom
   cd tests && node build-demo.mjs && node test-tts.mjs && node test-dom.mjs \
     && node test-mobile.mjs && node test-paginated.mjs && node test-audio.mjs
   ```
3. ארוז זיפ (בלי `node_modules` ובלי קבצי ה-demo שנוצרים אוטומטית).
4. העלה ב-claude.ai על הסקיל הקיים. **בלי השלב הזה שום צ'אט לא רואה את השינוי.**

## מגבלת סביבה

`scripts/make-audio.mjs` דורש `edge-tts`, שפותח WebSocket ל-Microsoft.
זה **לא עובד בקונטיינר ענן** (הפרוקסי לא מעביר WebSocket upgrades) — יש
להריץ אותו על מחשב מקומי. כל השאר, כולל הבדיקות ב-`--dry-run`, עובד בכל מקום.
