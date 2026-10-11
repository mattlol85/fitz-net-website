window.addEventListener('load', function() {
  try {
    // only greet visitors who haven't already seen the message
    if (localStorage.getItem('greetingShown')) return;
    window.alert('Hello, World!');
    // display the greeting message (skip if the page has no greeting element)
    const greeting = document.getElementById('greeting-message');
    if (greeting) greeting.style.display = 'block';
    // remember that the message has been shown
    localStorage.setItem('greetingShown', 'true');
  } catch {
    // storage blocked (e.g. private mode): skip the greeting rather than throw
  }
});
