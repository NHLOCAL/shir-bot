// מקבל את הנתיב מה-URL הנוכחי
var path = window.location.pathname;

// בודק אם הנתיב מתחיל ב-/artists/list/
if (path.startsWith('/shir-bot/artists/list/')) {
	// מסיר את החלק של "list" מהנתיב
	var newPath = path.replace('/list/', '/');

	// מחליף רווחים במקפים
	newPath = newPath.replace(/%20/g, '-');

	// יוצר את ה-URL החדש
	var newUrl = window.location.origin + newPath;

	// מבצע הפניה ל-URL החדש
	window.location.href = newUrl;
}