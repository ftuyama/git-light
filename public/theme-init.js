;(function () {
  try {
    var raw = localStorage.getItem('git-light:preferences')
    if (!raw) {
      document.documentElement.dataset.theme = 'default'
      return
    }
    var prefs = JSON.parse(raw)
    var theme = prefs.theme || 'default'
    var resolved = theme
    if (theme === 'system') {
      resolved = window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'default'
        : 'light'
    }
    document.documentElement.dataset.theme = resolved
  } catch (e) {
    document.documentElement.dataset.theme = 'default'
  }
})()
