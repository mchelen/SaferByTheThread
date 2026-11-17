'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const PH = require('../../tools/photos.js');
test('photo URLs at other sizes count as the same picture', () => {
  assert.equal(PH.imageId('https://cdn.shop.com/files/mat_1024x1024.jpg?v=1'), PH.imageId('https://cdn.shop.com/files/mat.jpg'));
  assert.equal(PH.imageId('https://shop.com/wp-content/uploads/mat-300x240.jpg'), PH.imageId('https://shop.com/wp-content/uploads/mat.jpg'));
  assert.deepEqual(PH.candidates([['https://a.com/logo.png', 'https://a.com/x_600x.jpg'], ['https://a.com/x.jpg', 'https://a.com/y.jpg']]), ['https://a.com/x_600x.jpg', 'https://a.com/y.jpg']);
  assert.deepEqual(PH.shopifyImages({ product: { images: [{ src: '//cdn.x/a.jpg' }] } }), ['https://cdn.x/a.jpg']);
});
test('product photos named "silicone" are not skipped as icons', () => {
  const u = 'https://cdn.shopify.com/s/files/1/0684/files/Silicone-Starter-Cup-Mushie-126806380.jpg?v=1';
  assert.deepEqual(PH.candidates([[u, 'https://a.com/cart-icon.png', 'https://a.com/icons/x.jpg']]), [u]);
});
