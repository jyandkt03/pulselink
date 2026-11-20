// 화면 전환: data-go="화면 id" 버튼을 누르면 그 화면만 보여 줍니다.
function show(id) {
  document.querySelectorAll('.screen').forEach((s) => { s.hidden = s.id !== id; });
  window.scrollTo(0, 0);
}

document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-go]');
  if (btn) show(btn.dataset.go);
});
