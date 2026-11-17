;(function () {
  function prefersDark() {
    try {
      return window.matchMedia('(prefers-color-scheme: dark)').matches
    } catch (e) {
      return false
    }
  }

  function resolve(theme) {
    if (theme !== 'system') return theme
    return prefersDark() ? 'default' : 'light'
  }

  try {
    var raw = localStorage.getItem('git-light:preferences')
    var prefs = raw ? JSON.parse(raw) : null
    // Follow the OS by default; stay light when it reports no preference.
    document.documentElement.dataset.theme = resolve((prefs && prefs.theme) || 'system')
  } catch (e) {
    document.documentElement.dataset.theme = resolve('system')
  }
})()
