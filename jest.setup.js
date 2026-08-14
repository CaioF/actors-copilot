if (typeof window !== 'undefined' && window.HTMLMediaElement) {
  window.HTMLMediaElement.prototype.load = jest.fn();
  window.HTMLMediaElement.prototype.pause = jest.fn();
}
