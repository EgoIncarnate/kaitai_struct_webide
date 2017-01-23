﻿declare function require(path: string): any;
var bigInt = require('lib/BigInteger/BigInteger.js');
declare var TextDecoder: any; // browser built-in 

export default class ConverterPanel {
    constructor(public panel: JQuery) { }

    refresh(dataProvider: IDataProvider, offset: number) {

        if (dataProvider && offset !== -1) {
            var data = dataProvider.get(offset, Math.min(dataProvider.length - offset, 64)).slice(0);

            function numConv(len, signed, bigEndian) {
                if (len > data.length) return '';

                var arr = data.subarray(0, len);

                var num = bigInt(0);
                if (bigEndian)
                    for (var i = 0; i < arr.length; i++)
                        num = num.multiply(256).add(arr[i]);
                else
                    for (var i = arr.length - 1; i >= 0; i--)
                        num = num.multiply(256).add(arr[i]);

                if (signed) {
                    var maxVal = bigInt(256).pow(len);
                    if (num.greaterOrEquals(maxVal.divide(2)))
                        num = maxVal.minus(num).negate();
                }

                //console.log('numConv', arr, len, signed ? 'signed' : 'unsigned', bigEndian ? 'big-endian' : 'little-endian', num, typeof num);
                return num;
            }

            [1, 2, 4, 8].forEach(len => [false, true].forEach(signed => [false, true].forEach(bigEndian =>
                this.panel.find(`.i${len * 8}${len == 1 ? '' : bigEndian ? 'be' : 'le'} .${signed ? 'signed' : 'unsigned'}`).text(numConv(len, signed, bigEndian).toString()))));

            var u32le = numConv(4, false, false);
            var unixtsDate = new Date(u32le * 1000);

            this.panel.find(`.float .val`).text(data.length >= 4 ? new Float32Array(data.buffer.slice(0, 4))[0] : '');
            this.panel.find(`.double .val`).text(data.length >= 8 ? new Float64Array(data.buffer.slice(0, 8))[0] : '');
            this.panel.find(`.unixts .val`).text(unixtsDate.format('Y-m-d H:i:s'));

            function strDecode(enc) {
                var str = new TextDecoder(enc).decode(data);
                for (var i = 0; i < str.length; i++)
                    if (str[i] === '\0')
                        return str.substring(0, i);
                return str + "...";
            }

            //console.log('refreshConverterPanel data', data);

            try {
                this.panel.find(`.ascii   .val`).text(strDecode('ascii'));
                this.panel.find(`.utf8    .val`).text(strDecode('utf-8'));
                this.panel.find(`.utf16le .val`).text(strDecode('utf-16le'));
                this.panel.find(`.utf16be .val`).text(strDecode('utf-16be'));
            } catch (e) {
                console.log('refreshConverterPanel str', e);
            }
        }
        else
            this.panel.find('.val').text('');
    }
}