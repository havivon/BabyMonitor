# BabyMonitor — מעקב האכלה וגדילה

אפליקציית PWA בעברית (RTL) למעקב אחר האכלות והנקות של תינוק ואחר הגדילה שלו. האפליקציה מותאמת לשימוש ביד אחת ובלילה, עובדת גם ללא חיבור לאינטרנט, וכל הנתונים נשמרים במכשיר בלבד.

## יכולות

- **הנקה** — טיימר עם צד ימין/שמאל, החלפת צד, השהיה, עריכת שעת התחלה, רישום ידני, והצעה לצד הבא. הטיימר ממשיך לרוץ גם אחרי סגירת האפליקציה.
- **בקבוק** — חלב אם שאוב או תמ"ל, כמות במ"ל או ב-oz, בחירות מהירות, והזנה של שעה בדיעבד.
- **מוצקים** — מזונות, כמות, סימון "מזון חדש" ותגובות (לצורך מעקב אחר אלרגיות).
- **דשבורד** — זמן מאז ההאכלה האחרונה, הצד הבא, וסיכומים יומיים. לתינוקות שניזונים בעיקר מבקבוק: טווח כמות חלב יומית מומלצת.
- **היסטוריה** — ציר זמן מקובץ לפי ימים, סינון לפי סוג, עריכה ומחיקה עם אפשרות ביטול.
- **גדילה** — משקל, אורך והיקף ראש. גרף עם עקומות האחוזונים של ארגון הבריאות העולמי (WHO), האחוזון הנוכחי, קצב העלייה במשקל, ותובנות כמו ירידה ממשקל הלידה או חציית אחוזונים.
- **סטטיסטיקה** — ממוצעים ל-7, 14 או 30 ימים, עם גרפים והשוואה לתקופה הקודמת.
- **הגדרות** — כמה ילדים, יחידות מידה (מ"ל/oz, ק"ג/lb), ערכת נושא (בהירה/כהה/אוטומטית), גיבוי ושחזור JSON, ייצוא CSV ומחיקת נתונים.

> החישובים מבוססים על הנחיות כלליות ועל טבלאות WHO, והם אינם מחליפים ייעוץ רפואי.

## הרצה

```bash
npm install
npm run dev        # סביבת פיתוח
npm run build      # בנייה לפרודקשן (dist/)
npm run preview    # הגשת גרסת הבנייה
```

## אנדרואיד (APK)

האפליקציה עטופה כאפליקציית אנדרואיד באמצעות Capacitor (`android/`). קובצי האתר נארזים בתוך ה-APK, כך שהיא עובדת לגמרי בלי אינטרנט.

- **הורדה:** כל push מריץ את ה-workflow ‏`Android APK` ב-GitHub Actions. הוא מפרסם קובץ APK בדף ה-Releases של המאגר (pre-release בשם `android-build-N`), וגם כ-artifact של ההרצה.
- **התקנה:** מורידים את הקובץ בטלפון, פותחים אותו ומאשרים "התקנה ממקורות לא ידועים". זו גרסת debug חתומה.
- **בנייה מקומית** (דורשת Android SDK ו-JDK 21):

```bash
npm run build:android                 # בניית האתר במצב android + cap sync
cd android && ./gradlew assembleDebug  # הקובץ נוצר ב-android/app/build/outputs/apk/debug/
```

## חשבונות וסנכרון משפחתי (Firebase)

ההתחברות אופציונלית (Google או דוא״ל וסיסמה). בלי הגדרות Firebase האפליקציה מקומית בלבד וכל ממשק החשבון מוסתר. ארכיטקטורה: `docs/ACCOUNTS.md`; קוד: `src/platform/cloud/`; כללי אבטחה: `firestore.rules`.

**הקמת פרויקט Firebase (פעם אחת, בעל המוצר):**

1. ב-[Firebase console](https://console.firebase.google.com) ליצור פרויקט ולהפעיל **Authentication** ← Sign-in method: ‏**Email/Password** ו-**Google**, ו-**Cloud Firestore**.
2. לפרוס את כללי האבטחה: `npx firebase deploy --only firestore:rules --project <project-id>`.
3. **אפליקציית Web:** להוסיף Web app ולהעתיק את ה-config ל-`src/platform/cloud/config.ts`, או להגדיר משתני סביבה `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID` (ב-GitHub: Settings ← Variables). זה config ציבורי מעצם הגדרתו; האבטחה באה מהכללים. להוסיף את דומיין האתר ל-Authorized domains.
4. **אפליקציית Android:** להוסיף Android app עם package ‏`com.havivon.babymonitor` ולרשום את טביעת האצבע **SHA-1** של מפתח החתימה הקבוע:

   ```
   AD:FD:8C:98:81:AB:8D:47:C6:97:BA:EF:0E:2C:83:A7:3F:A4:7D:5C
   ```

   להוריד את `google-services.json` ולשמור אותו בקידוד base64 כ-secret בשם `GOOGLE_SERVICES_JSON_BASE64` (‏`base64 -w0 google-services.json`). ה-workflow כותב אותו ל-`android/app/` בזמן הבנייה; הקובץ לא נשמר במאגר. התחברות Google באנדרואיד נעשית בחלון המקורי של Google ‏(`@capacitor-firebase/authentication`) והסשן מנוהל ב-Firebase JS SDK.

**פיתוח מקומי מול אמולטורים** (ללא פרויקט אמיתי, project id ‏`demo-babymonitor`, נדרש Java 21):

```bash
npm run emulators                                  # Auth ‏(9099) + Firestore ‏(8080)
VITE_FIREBASE_EMULATORS=1 npm run dev              # האפליקציה מתחברת לאמולטורים
npm run test:rules                                 # בדיקות כללי האבטחה + סנכרון בין שני מכשירים
```

## בדיקות ואיכות

```bash
npm run lint && npm run typecheck && npm run format:check
npm test           # בדיקות יחידה ורכיבים (Vitest)
npm run e2e        # בדיקות קצה-לקצה (Playwright, Chromium, מסך מובייל)
npm run test:rules # כללי Firestore וסנכרון משפחתי מול אמולטורי Firebase (Java 21)
```

## מבנה

| נתיב                          | תוכן                                                                                          |
| ----------------------------- | --------------------------------------------------------------------------------------------- |
| `src/domain/`                 | לוגיקה טהורה (ללא React): האכלות, טיימר, יחידות, גיל, גיבוי, וחישובי גדילה לפי WHO (שיטת LMS) |
| `src/store/`                  | ניהול מצב עם Zustand ושמירה ב-localStorage, כולל גרסאות סכימה והגנה מנתונים פגומים            |
| `src/features/`               | המסכים: בית, הזנה, היסטוריה, גדילה, סטטיסטיקה, הגדרות, הרשמה ראשונית                          |
| `src/components/`, `src/app/` | רכיבים משותפים ושלד האפליקציה                                                                 |
| `src/styles/`                 | מערכת העיצוב (טוקנים, רכיבים, מצב כהה)                                                        |
| `data/who/`                   | טבלאות LMS הרשמיות של WHO (מקור לקבצים הנוצרים ב-`src/domain/growth/data/`)                   |
| `docs/`                       | אפיון המוצר (PRD), מערכת העיצוב, סקירת העיצוב ודוח QA                                         |
| `e2e/`                        | בדיקות קצה-לקצה                                                                               |
| `src/platform/cloud/`         | חשבונות, משפחה וסנכרון (Firebase, נטען רק בעת הצורך)                                          |
| `tests/`                      | בדיקות מול אמולטורי Firebase: כללי אבטחה ושני מכשירים במשפחה אחת                              |
