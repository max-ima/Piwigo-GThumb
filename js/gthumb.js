var GThumb = {

  selector: null,
  max_height: 200,
  margin: 10,
  max_first_thumb_width: 0.7,
  big_thumb: null,
  small_thumb: null,
  method: 'crop',
  t: new Array,

  queue: jQuery.manageAjax.create('queued', {
    queue: true,  
    cacheResponse: false,
    maxRequests: 2,
    preventDoubleRequests: false
  }),

  build: function (selector) {

    this.selector = selector;
    jQuery(selector+' img').each(function() {
      id = parseInt(this.id.substring(2));
      width = parseInt(jQuery(this).attr('width'));
      height = parseInt(jQuery(this).attr('height'));
      GThumb.t.push({id:id,width:width,height:height});

      if (jQuery(this).attr('src') == '' && id != GThumb.big_thumb.id) {
        GThumb.addToQueue(id, 1);
      }
    });

    jQuery.resize.throttleWindow = false;
    jQuery.resize.delay = 50;
    jQuery(selector).resize(function() { GThumb.process(); });
    this.process();
  },

  addToQueue: function (id, loop) {

    this.queue.add({
      type: 'GET', 
      url: 'ws.php', 
      data: {
        method: 'pwg.images.getGThumbPlusThumbnail',
        image_id: id,
        format: 'json'
      },
      dataType: 'json',
      success: function(data) {
        if (data.stat == 'ok') {
          jQuery('#gt'+data.result.id).prop('src', data.result.src).show();
        } else if (loop < 4) {
          GThumb.addToQueue(id, ++loop);
        }
      },
      error: function() {
        if (loop < 4) GThumb.addToQueue(id, ++loop);
      }
    });
  },

  process: function() {

    var width_count = this.margin;
    var line = 1;
    var round_rest = 0;
    var main_width = jQuery(this.selector).width();
    var first_thumb = jQuery(this.selector+' img:first');
    var best_size = {width:1,height:1};

    if (this.big_thumb != null && this.big_thumb.height < main_width * this.max_first_thumb_width) {

      // Compute best size for landscape picture (we choose bigger height)
      min_ratio = Math.min(1, this.big_thumb.width/this.big_thumb.height);

      for(width = this.big_thumb.width; width/best_size.height>=min_ratio; width--) {
        width_count = this.margin;
        height = this.margin;
        max_height = 0;
        available_width = main_width - (width + this.margin);
        line = 1;
        for (i=1;i<this.t.length;i++) {

          width_count += this.t[i].width + this.margin;
          max_height = Math.max(this.t[i].height, max_height);

          if (width_count > available_width) {
            ratio = width_count / available_width;
            height += Math.round(max_height / ratio);
            line++;
            max_height = 0;
            width_count = this.margin;
            if (line > 2) {
              if (height >= best_size.height && width/height >= min_ratio && height<=this.big_thumb.height) {
                best_size = {width:width,height:height}
              }
              break;
            }
          }
        }
        if (line <= 2) {
          if (max_height == 0 || line == 1) {
            height = this.big_thumb.height;
          } else {
            height += max_height;
          }
          if (height >= best_size.height && width/height >= min_ratio && height<=this.big_thumb.height) {
            best_size = {width:width,height:height}
          }
        }
      }

      if (this.big_thumb.src != first_thumb.attr('src')) {
        first_thumb.attr('src', this.big_thumb.src).attr({width:this.big_thumb.width,height:this.big_thumb.height});
        this.t[0].width = this.big_thumb.width;
        this.t[0].height = this.big_thumb.height;
      }
      this.t[0].crop = best_size.width;
      this.resize(first_thumb, this.big_thumb.width, this.big_thumb.height, best_size.width, best_size.height, 'crop');

    }

    if (best_size.width == 1) {
      if (this.small_thumb != null && this.small_thumb.src != first_thumb.attr('src')) {  
        first_thumb.prop('src', this.small_thumb.src).attr({width:this.small_thumb.width,height:this.small_thumb.height});
        this.t[0].width = this.small_thumb.width;
        this.t[0].height = this.small_thumb.height;
      }
      this.t[0].crop = false;
    }

    width_count = this.margin;
    max_height = 0;
    line = 1;
    thumb_process = new Array;

    for (i=this.t[0].crop!=false?1:0;i<this.t.length;i++) {

      width_count += this.t[i].width + this.margin;
      max_height = Math.max(this.t[i].height, max_height);
      thumb_process.push(this.t[i]);

      available_width = main_width;
      if (line <= 2 && this.t[0].crop !== false) {
        available_width -= (this.t[0].crop + this.margin);
      }

      if (width_count > available_width) {

        last_thumb = this.t[i].id;
        ratio = width_count / available_width;
        new_height = Math.round(max_height / ratio);
        round_rest = 0;
        width_count = this.margin;

        for (j=0;j<thumb_process.length;j++) {

          if (thumb_process[j].id == last_thumb) {
            new_width = available_width - width_count - this.margin;
          } else {
            new_width = (thumb_process[j].width + round_rest) / ratio;
            round_rest = new_width - Math.round(new_width);
            new_width = Math.round(new_width);
          }
          this.resize(jQuery('#gt'+thumb_process[j].id), thumb_process[j].width, thumb_process[j].height, new_width, new_height, this.method);

          width_count += new_width + this.margin;
        }
        thumb_process = new Array;
        width_count = this.margin;
        max_height = 0;
        line++;
      }
    }

    // Last line does not need to be cropped
    for (j=0;j<thumb_process.length;j++) {
      this.resize(jQuery('#gt'+thumb_process[j].id), thumb_process[j].width, thumb_process[j].height, thumb_process[j].width, max_height, this.method);
    }

    if (main_width != jQuery(this.selector).width()) {
      this.process();
    }
  },

  resize: function(thumb, width, height, new_width, new_height, method) {

    if (method == 'resize') {
      thumb.css({
        height: new_height+'px',
        width: new_width+'px'
      });
      height_crop = 0;
      width_crop = 0;
    } else {
      thumb.css({height: '', width: ''});
      height_crop = Math.round((height - new_height)/2);
      width_crop = Math.round((width - new_width)/2);
    }

    thumb.parents('li').css({
      height: new_height+'px',
      width: new_width+'px'
    });
    thumb.parent('a').css({
      clip: 'rect('+height_crop+'px, '+(new_width+width_crop)+'px, '+(new_height+height_crop)+'px, '+width_crop+'px)',
      top: -height_crop+'px',
      left: -width_crop+'px'
    });
  }
}