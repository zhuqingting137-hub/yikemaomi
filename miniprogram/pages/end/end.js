Page({
  back: function () {
    wx.navigateBack({
      fail: function () {
        wx.reLaunch({ url: '/pages/index/index' });
      }
    });
  }
});
