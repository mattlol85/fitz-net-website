function createContext() {
  return {
    font: '',
    fillStyle: '',
    textAlign: 'left',
    textBaseline: 'top',
    fillText() {},
    measureText(text = '') {
      return { width: String(text).length * 10 };
    },
  };
}

function createCanvas(width = 0, height = 0) {
  return {
    width,
    height,
    getContext(type) {
      if (type !== '2d') return null;
      return createContext();
    },
    toBuffer() {
      return Buffer.alloc(0);
    },
  };
}

module.exports = {
  createCanvas,
};

