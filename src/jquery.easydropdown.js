/*
* EASYDROPDOWN - A Drop-down Builder for Styleable Inputs and Menus
* Version: 2.1.3
* License: Creative Commons Attribution 3.0 Unported - CC BY 3.0
* http://creativecommons.org/licenses/by/3.0/
* This software may be used freely on commercial and non-commercial projects with attribution to the author/copyright holder.
* Author: Patrick Kunka
* Copyright 2013 Patrick Kunka, All Rights Reserved
*
* Modify by HuangFei on 2019.7.2
* 尽量不该原代码逻辑，避免BUG
* 修改内容：
* 1.下拉框固定高度改为自动高度，可以设置最大高度。（需要改样式和代码）
* 2.增加模糊搜索
* 3.select选择使用delegate注册事件
* 4.select选择的原理是用index和原select的index匹配并同步
*/


(function ($) {

    function EasyDropDown() {
        this.isField = true;
        this.enableSearch = true;
        this.down = false;
        this.inFocus = false;
        this.disabled = false;
        this.cutOff = false;
        this.hasLabel = false;
        this.keyboardMode = false;
        this.nativeTouch = true;
        this.wrapperClass = 'dropdown';
        this.onChange = null;
    };

    EasyDropDown.prototype = {
        constructor: EasyDropDown,
        instances: [],
        init: function (domNode, settings) {
            var self = this;

            $.extend(self, settings);
            self.$select = $(domNode);
            self.id = domNode.id;
            self.options = [];
            self.$options = self.$select.find('option');
            self.isTouch = 'ontouchend' in document;
            self.$select.removeClass(self.wrapperClass + ' dropdown');
            if (self.$select.is(':disabled')) {
                self.disabled = true;
            }

            if (self.$options.length) {
                self.$options.each(function (i) {
                    var $option = $(this);
                    if ($option.is(':selected')) {
                        self.selected = {
                            index: i,
                            title: $option.text()
                        }
                        self.focusIndex = i;
                    }
                    if ($option.hasClass('label') && i == 0) {
                        self.hasLabel = true;
                        self.label = $option.text();
                        $option.attr('value', '');
                    } else {
                        self.options.push({
                            domNode: $option[0],
                            title: $option.text(),
                            value: $option.val(),
                            selected: $option.is(':selected')
                        });
                    }
                });
                if (!self.selected) {
                    self.selected = {
                        index: 0,
                        title: self.$options.eq(0).text()
                    }
                    self.focusIndex = 0;
                }

                self.render();
            }
        },

        render: function () {
            var self = this,
                touchClass = self.isTouch && self.nativeTouch ? ' touch' : '',
                disabledClass = self.disabled ? ' disabled' : '';

            self.$container = self.$select.wrap('<div class="' + self.wrapperClass + touchClass + disabledClass + '"><span class="old"/></div>').parent().parent();
            self.$active = $('<span class="selected">' + self.selected.title + '</span>').appendTo(self.$container);
            self.$carat = $('<span class="carat"/>').appendTo(self.$container);
            self.$scrollWrapper = $('<div><ul/></div>').appendTo(self.$container);
            if (self.enableSearch) {
                self.$scrollWrapper.prepend('<div style="display: none"><input/></div>').addClass('search');
            }
            self.$dropDown = self.$scrollWrapper.find('ul').hide();
            self.$form = self.$container.closest('form');
            $.each(self.options, function (index) {
                var option = this,
                    active = option.selected ? ' class="active"' : '';
                self.$dropDown.append('<li' + active + ' data-index="' + index + '">' + option.title + '</li>');
            });
            self.$items = self.$dropDown.find('li');
            self.maxHeight = 0;
            if (self.cutOff && self.$items.length > self.cutOff) self.$container.addClass('scrollable');
            for (i = 0; i < self.$items.length; i++) {
                var $item = self.$items.eq(i);
                self.maxHeight += $item.outerHeight();
                if (self.cutOff == i + 1) {
                    break;
                }
            }

            if (self.isTouch && self.nativeTouch) {
                self.bindTouchHandlers();
            } else {
                self.bindHandlers();
            }
        },

        bindTouchHandlers: function () {
            var self = this;
            self.$container.on('click.easyDropDown', function () {
                self.$select.focus();
            });
            self.$select.on({
                change: function () {
                    var $selected = $(this).find('option:selected'),
                        title = $selected.text(),
                        value = $selected.val();

                    self.$active.text(title);
                    if (typeof self.onChange === 'function') {
                        self.onChange.call(self.$select[0], {
                            title: title,
                            value: value
                        });
                    }
                },
                focus: function () {
                    self.$container.addClass('focus');
                },
                blur: function () {
                    self.$container.removeClass('focus');
                }
            });
        },

        bindHandlers: function () {
            var self = this;
            self.query = '';
            self.$container.on({
                'click.easyDropDown': function (e) {
                    if (e.target.localName != 'input') {
                        if (!self.down && !self.disabled) {
                            self.open();
                        } else {
                            self.close();
                        }
                    }
                },
                'mousemove.easyDropDown': function () {
                    if (self.keyboardMode) {
                        self.keyboardMode = false;
                    }
                }
            });

            $('body').on('click.easyDropDown.' + self.id, function (e) {
                var $target = $(e.target),
                    classNames = self.wrapperClass.split(' ').join('.');

                if (!$target.closest('.' + classNames).length && self.down) {
                    self.close();
                }
            });

            // 模糊搜索
            self.$container.find('.search>div>input').on({
                'input propertychange.easyDropDown': function () {
                    self.$dropDown.empty();
                    var keyWord = $(this).val();
                    self.$items.each(function (index, item) {
                        if ($(item).text().indexOf(keyWord) >= 0) {
                            self.$dropDown.append(item);
                        }
                    });
                    if (self.$dropDown.find('li').length == 0) {
                        self.$dropDown.append('<li class="disabled">未找到结果</li>');
                    }
                }
            });

            // 选择select
            self.$dropDown.delegate('li', 'click.easyDropDown', function () {
                if ($(this).hasClass('disabled')) return false;
                var index = $(this).data('index');
                self.select(index);
                self.$select.focus();
            });
            self.$dropDown.delegate('li', 'mouseover.easyDropDown', function () {
                if (!self.keyboardMode) {
                    var $t = $(this);
                    $t.addClass('focus').siblings().removeClass('focus');
                    self.focusIndex = $t.index();
                }
            });
            self.$dropDown.delegate('li', 'mouseout.easyDropDown', function () {
                if (!self.keyboardMode) {
                    $(this).removeClass('focus');
                }
            });

            self.$select.on({
                'focus.easyDropDown': function () {
                    self.$container.addClass('focus');
                    self.inFocus = true;
                },
                'blur.easyDropDown': function () {
                    self.$container.removeClass('focus');
                    self.inFocus = false;
                },
                'keydown.easyDropDown': function (e) {
                    if (self.inFocus) {
                        self.keyboardMode = true;
                        var key = e.keyCode;

                        if (key == 38 || key == 40 || key == 32) {
                            e.preventDefault();
                            if (key == 38) {
                                self.focusIndex--
                                self.focusIndex = self.focusIndex < 0 ? self.$items.length - 1 : self.focusIndex;
                            } else if (key == 40) {
                                self.focusIndex++
                                self.focusIndex = self.focusIndex > self.$items.length - 1 ? 0 : self.focusIndex;
                            }

                            if (!self.down) {
                                self.open();
                            }

                            self.$items.removeClass('focus').eq(self.focusIndex).addClass('focus');
                            if (self.cutOff) {
                                self.scrollToView();
                            }

                            self.query = '';
                        }
                        if (self.down) {
                            if (key == 9 || key == 27) {
                                self.close();
                            } else if (key == 13) {
                                e.preventDefault();
                                self.select(self.focusIndex);
                                self.close();
                                return false;
                            } else if (key == 8) {
                                e.preventDefault();
                                self.query = self.query.slice(0, -1);
                                self.search();
                                clearTimeout(self.resetQuery);
                                return false;
                            } else if (key != 38 && key != 40) {
                                var letter = String.fromCharCode(key);
                                self.query += letter;
                                self.search();
                                clearTimeout(self.resetQuery);
                            }
                        }
                    }
                },
                'keyup.easyDropDown': function () {
                    self.resetQuery = setTimeout(function () {
                        self.query = '';
                    }, 1200);
                }
            });

            self.$dropDown.on('scroll.easyDropDown', function (e) {
                if (self.$dropDown[0].scrollTop >= self.$dropDown[0].scrollHeight - self.maxHeight) {
                    self.$container.addClass('bottom');
                } else {
                    self.$container.removeClass('bottom');
                }
            });

            if (self.$form.length) {
                self.$form.on('reset.easyDropDown', function () {
                    var active = self.hasLabel ? self.label : self.options[0].title;
                    self.$active.text(active);
                });
            }
        },

        unbindHandlers: function () {
            var self = this;

            self.$container
                .add(self.$select)
                .add(self.$items)
                .add(self.$form)
                .add(self.$dropDown)
                .off('.easyDropDown');
            $('body').off('.' + self.id);
        },

        open: function () {
            var self = this,
                scrollTop = window.scrollY || document.documentElement.scrollTop,
                scrollLeft = window.scrollX || document.documentElement.scrollLeft,
                scrollOffset = self.notInViewport(scrollTop);

            self.closeAll();
            self.$select.focus();
            window.scrollTo(scrollLeft, scrollTop + scrollOffset);
            self.$container.addClass('open');
            self.$container.find('.search>div').show();
            self.$container.find('ul').slideDown(150);
            self.down = true;
        },

        close: function () {
            var self = this;
            self.$container.removeClass('open');
            if(self.enableSearch){
                self.$container.find('.search>div').fadeOut(150,function () {
                    $(this).find('input').val('').trigger('propertychange');
                });
            }

            self.$container.find('ul').slideUp(150);
            self.focusIndex = self.selected.index;
            self.query = '';
            self.down = false;
        },

        closeAll: function () {
            var self = this,
                instances = Object.getPrototypeOf(self).instances;
            for (var key in instances) {
                var instance = instances[key];
                instance.close();
            }
        },

        select: function (index) {
            var self = this;

            if (typeof index === 'string') {
                index = self.$select.find('option[value=' + index + ']').index() - 1;
            }

            var option = self.options[index],
                selectIndex = self.hasLabel ? index + 1 : index;
            self.$items.removeClass('active').eq(index).addClass('active');
            self.$active.text(option.title);
            self.$select
                .find('option')
                .removeAttr('selected')
                .eq(selectIndex)
                .prop('selected', true)
                .parent()
                .trigger('change');

            self.selected = {
                index: index,
                title: option.title
            };
            self.focusIndex = i;
            if (typeof self.onChange === 'function') {
                self.onChange.call(self.$select[0], {
                    title: option.title,
                    value: option.value
                });
            }
        },

        search: function () {
            var self = this,
                lock = function (i) {
                    self.focusIndex = i;
                    self.$items.removeClass('focus').eq(self.focusIndex).addClass('focus');
                    self.scrollToView();
                },
                getTitle = function (i) {
                    return self.options[i].title.toUpperCase();
                };

            for (i = 0; i < self.options.length; i++) {
                var title = getTitle(i);
                if (title.indexOf(self.query) == 0) {
                    lock(i);
                    return;
                }
            }

            for (i = 0; i < self.options.length; i++) {
                var title = getTitle(i);
                if (title.indexOf(self.query) > -1) {
                    lock(i);
                    break;
                }
            }
        },

        scrollToView: function () {
            var self = this;
            if (self.focusIndex >= self.cutOff) {
                var $focusItem = self.$items.eq(self.focusIndex),
                    scroll = ($focusItem.outerHeight() * (self.focusIndex + 1)) - self.maxHeight;

                self.$dropDown.scrollTop(scroll);
            }
        },

        notInViewport: function (scrollTop) {
            var self = this,
                range = {
                    min: scrollTop,
                    max: scrollTop + (window.innerHeight || document.documentElement.clientHeight)
                },
                menuBottom = self.$dropDown.offset().top + self.maxHeight;

            if (menuBottom >= range.min && menuBottom <= range.max) {
                return 0;
            } else {
                return (menuBottom - range.max) + 5;
            }
        },

        destroy: function () {
            var self = this;
            self.unbindHandlers();
            self.$select.unwrap().siblings().remove();
            self.$select.unwrap();
            delete Object.getPrototypeOf(self).instances[self.$select[0].id];
        },

        disable: function () {
            var self = this;
            self.disabled = true;
            self.$container.addClass('disabled');
            self.$select.attr('disabled', true);
            if (!self.down) self.close();
        },

        enable: function () {
            var self = this;
            self.disabled = false;
            self.$container.removeClass('disabled');
            self.$select.attr('disabled', false);
        }
    };

    var instantiate = function (domNode, settings) {
            domNode.id = !domNode.id ? 'EasyDropDown' + rand() : domNode.id;
            var instance = new EasyDropDown();
            if (!instance.instances[domNode.id]) {
                instance.instances[domNode.id] = instance;
                instance.init(domNode, settings);
            }
        },
        rand = function () {
            return ('00000' + (Math.random() * 16777216 << 0).toString(16)).substr(-6).toUpperCase();
        };

    $.fn.easyDropDown = function () {
        var args = arguments,
            dataReturn = [],
            eachReturn;

        eachReturn = this.each(function () {
            if (args && typeof args[0] === 'string') {
                var data = EasyDropDown.prototype.instances[this.id][args[0]](args[1], args[2]);
                if (data) dataReturn.push(data);
            } else {
                instantiate(this, args[0]);
            }
        });

        if (dataReturn.length) {
            return dataReturn.length > 1 ? dataReturn : dataReturn[0];
        } else {
            return eachReturn;
        }
    };

    $(function () {
        if (typeof Object.getPrototypeOf !== 'function') {
            if (typeof 'test'.__proto__ === 'object') {
                Object.getPrototypeOf = function (object) {
                    return object.__proto__;
                };
            } else {
                Object.getPrototypeOf = function (object) {
                    return object.constructor.prototype;
                };
            }
        }

        $('select.dropdown').each(function () {
            var json = $(this).attr('data-settings');
            settings = json ? $.parseJSON(json) : {};
            instantiate(this, settings);
        });
    });
})(jQuery);