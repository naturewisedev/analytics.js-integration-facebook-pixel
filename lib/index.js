
/**
 * Module dependencies.
 */

var integration = require('analytics.js-integration');
var foldl = require('foldl');
var each = require('each');

/**
 * Expose `Facebook Pixel`.
 */

var FacebookPixel = module.exports = integration('Facebook Pixel')
  .global('fbq')
  .option('pixelId', '')
  .option('pixelIds', [])
  .option('agent', 'seg')
  .mapping('standardEvents')
  .mapping('legacyEvents')
  .tag('<script src="//connect.facebook.net/en_US/fbevents.js">');

/**
 * Initialize Facebook Pixel.
 *
 * @param {Facade} page
 */

FacebookPixel.prototype.initialize = function(){
  window.fbq = window._fbq = function() {
    if (window.fbq.callMethod) {
      window.fbq.callMethod.apply(window.fbq, arguments);
    } else {
      window.fbq.queue.push(arguments);
    }
  };
  window.fbq.push = window.fbq;
  window.fbq.loaded = true;
  window.fbq.disablePushState = true; // disables automatic pageview tracking
  window.fbq.version = '2.0';
  window.fbq.queue = [];
  this.load(this.ready);
  var pixelIds = this.options.pixelIds.concat([this.options.pixelId]);
  var self = this;
  each(function(pixelId) {
    if (pixelId !== null && pixelId !== '') {
      window.fbq('init', pixelId);
      window.fbq('set', 'agent', self.options.agent, pixelId);
    }
  }, pixelIds);
};

/**
 * Has the Facebook Pixel library been loaded yet?
 *
 * @return {Boolean}
 */

FacebookPixel.prototype.loaded = function(){
  return !!(window.fbq && window.fbq.callMethod);
};

/**
 * Trigger a page view.
 *
 * @param {Facade} identify
 */

FacebookPixel.prototype.page = function(){
  window.fbq('track', 'PageView');
};

/**
 * Track an event.
 *
 * @param {Facade} track
 */

FacebookPixel.prototype.track = function(track){
  var event = track.event();
  var revenue = formatRevenue(track.revenue());

  var payload = foldl(function(acc, val, key) {
    if (key === 'revenue') {
      acc.value = revenue;
      return acc;
    }

    acc[key] = val;
    return acc;
  }, {}, track.properties());

  var standard = this.standardEvents(event);
  var legacy = this.legacyEvents(event);

  // non-mapped events get sent as "custom events" with full
  // tranformed payload
  if (![].concat(standard, legacy).length) {
    window.fbq('trackCustom', event, payload);
    return;
  }

  // standard conversion events, mapped to one of 9 standard events
  // send full transformed payload
  each(function(event) {
    window.fbq('track', event, payload);
  }, standard);

  // legacy conversion events — mapped to specific "pixelId"s
  // send only currency and value
  each(function(event) {
    window.fbq('track', event, {
      currency: track.currency(),
      value: revenue
    });
  }, legacy);
};

/**
 * Viewed product category.
 *
 * @api private
 * @param {Track} track category
 */

FacebookPixel.prototype.viewedProductCategory = function() {
  // FB is creating a new ViewCategory standard event for collection
  // view and we dont want to mix product view and collection view
  // using the same ViewContent standard event. Stop tracking until
  // ViewCategory is released.
};

// FacebookPixel.prototype.viewedProductCategory = function(track) {
//   window.fbq('track', 'ViewContent', {
//     content_ids: [track.category() || ''],
//     content_type: 'product_group'
//   });

//   // fall through for mapped legacy conversions
//   each(function(event) {
//     window.fbq('track', event, {
//       currency: track.currency(),
//       value: formatRevenue(track.revenue())
//     });
//   }, this.legacyEvents(track.event()));
// };

/**
 * Viewed product.
 *
 * @api private
 * @param {Track} track
 */

FacebookPixel.prototype.viewedProduct = function(track) {
  window.fbq('track', 'ViewContent', {
    content_ids: [getContentId(track)],
    content_type: getContentType(track),
    content_name: track.name() || '',
    content_category: track.category() || '',
    currency: track.currency(),
    value: formatRevenue(track.price())
  });

  // fall through for mapped legacy conversions
  each(function(event) {
    window.fbq('track', event, {
      currency: track.currency(),
      value: formatRevenue(track.revenue())
    });
  }, this.legacyEvents(track.event()));
};

/**
 * Added product.
 *
 * @api private
 * @param {Track} track
 */

FacebookPixel.prototype.addedProduct = function(track) {
  window.fbq('track', 'AddToCart', {
    content_ids: [getContentId(track)],
    content_type: getContentType(track),
    content_name: track.name() || '',
    content_category: track.category() || '',
    currency: track.currency(),
    value: formatRevenue(track.price()),
    num_items: track.quantity()
  });

  // fall through for mapped legacy conversions
  each(function(event) {
    window.fbq('track', event, {
      currency: track.currency(),
      value: formatRevenue(track.revenue())
    });
  }, this.legacyEvents(track.event()));
};

/**
 * Completed Order.
 *
 * @api private
 * @param {Track} track
 */

FacebookPixel.prototype.completedOrder = function(track) {
  var revenue = formatRevenue(track.revenue());

  window.fbq('track', 'Purchase', {
    content_ids: getProductsContentIds(track),
    content_type: getProductsContentType(track),
    currency: track.currency(),
    value: revenue,
    num_items: getNumItems(track)
  });

  // fall through for mapped legacy conversions
  each(function(event) {
    window.fbq('track', event, {
      currency: track.currency(),
      value: formatRevenue(track.revenue())
    });
  }, this.legacyEvents(track.event()));
};

/**
 * Started Order.
 *
 * @api private
 * @param {Track} track
 */

FacebookPixel.prototype.startedOrder = function(track) {
  var revenue = formatRevenue(track.revenue());

  window.fbq('track', 'InitiateCheckout', {
    content_ids: getProductsContentIds(track),
    content_type: getProductsContentType(track),
    currency: track.currency(),
    value: revenue,
    num_items: getNumItems(track)
  });

  // fall through for mapped legacy conversions
  each(function(event) {
    window.fbq('track', event, {
      currency: track.currency(),
      value: formatRevenue(track.revenue())
    });
  }, this.legacyEvents(track.event()));
};

/**
 * Get Revenue Formatted Correctly for FB.
 *
 * @api private
 * @param {Track} track
 */

function formatRevenue(revenue) {
  return Number(revenue || 0).toFixed(2);
}

/**
 * Get Content Id from a Product for FB.
 *
 * @api private
 * @param {Track} track
 */
function getContentId(track) {
  var props = track.properties();
  return props.productId || track.id() || track.sku() || '';
}

/**
 * Get Content Type from a Product for FB.
 *
 * @api private
 * @param {Track} track
 */
function getContentType(track) {
  var props = track.properties();
  return props.productId ? 'product_group' : 'product';
}

/**
 * Get Content Ids from Products for FB.
 *
 * @api private
 * @param {Track} track
 */
function getProductsContentIds(track) {
  var key;
  var content_ids = foldl(function(acc, product) {
    key = product.productId || product.id || product.sku;
    if (key) {
      var keyIndex = acc.indexOf(key);
      if (keyIndex === -1) acc.push(key);
    }
    return acc;
  }, [], track.products() || []);
  return content_ids;
}

/**
 * Get Content Type from Products for FB.
 *
 * @api private
 * @param {Track} track
 */
function getProductsContentType(track) {
  var products = track.products() || [];
  for (var i = 0; i < products.length; i++) {
    if (products[i].productId) {
      return 'product_group';
    }
  }
  return 'product';
}

/**
 * Get number of items from Products for FB.
 *
 * @api private
 * @param {Track} track
 */
function getNumItems(track) {
  var num_items = foldl(function(acc, product) {
    return acc + (product.quantity || 0);
  }, 0, track.products() || []);
  return num_items;
}
