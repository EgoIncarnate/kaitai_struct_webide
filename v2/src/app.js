var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
define(["require", "exports", 'aurelia-framework'], function (require, exports, aurelia_framework_1) {
    "use strict";
    class App {
        constructor() {
            App.instance = this;
            this.list1 = ["a", "<b>b</b>", "c"];
            this.list2 = ["d", "e"];
            this.selItem = "hello";
            this.converterPanelData = new Uint8Array([65, 66, 67, 68, 69, 70, 71, 72]);
        }
        start() {
            setTimeout(() => {
                this.converterPanelData = new Uint8Array([66, 67, 68, 69, 70, 71, 72, 73]);
            }, 1000);
            console.log(this.converterPanel);
        }
        selitemChanged() {
            console.log('selitemChanged');
        }
    }
    __decorate([
        aurelia_framework_1.bindable
    ], App.prototype, "selItem", void 0);
    exports.App = App;
});
//# sourceMappingURL=app.js.map