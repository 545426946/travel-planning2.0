/**
 * 创建地图标记图标
 * 运行: node scripts/create-marker-icon.js
 */

const fs = require('fs');
const path = require('path');

// 简单的红色标记图标 (28x36 像素的SVG转PNG)
// 这是一个最小化的PNG文件，显示一个红色水滴形状的标记
const markerPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAABwAAAAkCAYAAACaJFpUAAAACXBIWXMAAAsTAAALEwEAmpwYAAADHklEQVRIie2WS2gTURSGv5lJJk3SpE1t0qZNH9ZHfVRFRBQXLgQXIoiIC3HhQhCXLkRwIYgLFy5cuHDhQhAXLkRwIYgLQVy4EBGxPqq2tU1t0zRN0iSTZCYzLiZJk0xSW3Xhgj8Mw9x7/u+ce+65M/Af/xJCvQNKKQCEEP8qln8Ov4pwOBwmHA7/6zj+GH8VoZQiFAoRCoX+dSx/hL+KUEoRDAYJBoP/OpY/wl9FKKUIBAIEAoF/HcsfYVWEQggAhBD/Kpa/DqsiDAQC+P1+/H7/v47lj7AqQr/fj8/nw+fz/etY/girIvT5fHi9Xrxe77+O5Y+wKkKv14vH48Hj8fzrWP4IqyL0eDy43W7cbve/juWPsCpCt9uNy+XC5XL961j+CKsidLlcOJ1OnE7nv47lj7AqQqfTicPhwOFw/OtY/girInQ4HNjtdux2+7+O5Y+wKkK73Y7NZsNms/3rWP4IqyK02WxYrVasVuu/juWPsCpCq9WKxWLBYrH861j+CKsitFgsGI1GjEbjv47lj7AqQqPRiMFgwGAw/OtY/girIjQYDOj1evR6/b+O5Y+wKkK9Xo9Op0On0/3rWP4IqyLU6XRotVq0Wu2/juWPsCpCrVaLRqNBo9H861j+CKsi1Gg0qNVq1Gr1v47lj7AqQrVajUqlQqVS/etY/girIlSpVCiVSpRK5b+O5Y+wKkKlUolCoUChUPzrWP4IqyJUKBTI5XLkcvm/juWPsCpCuVyOTCZDJpP961j+CKsilMlkSKVSpFLpv47lj7AqQqlUikQiQSKR/OtY/girIpRIJIjFYsRi8b+O5Y+wKkKxWIxIJEIkEv3rWP4IqyIUiUQIhUKEQuG/juWPsCpCoVCIQCBAIBD861j+CKsilFIKPp8Pn8/3r2P5I6yKUEop+Hw+vF7vv47lj7AqQiml4PF48Hg8/zqWP8KqCKWUgtvtxu12/+tY/girIpRSCi6XC5fL9a9j+SOsilBKKTidTpxO57+O5Y+wKkIppeBwOHA4HP86lj/CqgillILdbsdut//rWP4IqyKUUgo2mw2bzfavY/kj/A+/4TfwC7gKXwAAAABJRU5ErkJggg==';

const outputPath = path.join(__dirname, '..', 'images', 'marker.png');

// 将Base64转换为Buffer并写入文件
const buffer = Buffer.from(markerPngBase64, 'base64');
fs.writeFileSync(outputPath, buffer);

console.log('标记图标已创建:', outputPath);
