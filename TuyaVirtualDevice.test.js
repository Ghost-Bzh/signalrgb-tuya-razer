import BaseClass from './Libs/BaseClass.test.js';
import DeviceList from './Data/DeviceList.test.js';
import TuyaDevice from './TuyaDevice.test.js';
import { Hex } from './Crypto/Hex.test.js';

export default class TuyaVirtualDevice extends BaseClass
{
    constructor(deviceData)
    {
        super();
        // Initialize tuya device from saved data
        this.tuyaDevice = new TuyaDevice(deviceData, null);
        this.frameDelay = 50; // Valeur par défaut
        this.lastRender = 0;

        this.setupDevice(this.tuyaDevice);
    }
    
    getLedNames()
    {
        let ledNames = [];
        for (let i = 1; i <= this.ledCount; i++)
        {
            ledNames.push(`Led ${i}`);
        }
        return ledNames;
    }

    getLedPositions()
    {
        let ledPositions = [];
        for (let i = 0; i < this.ledCount; i++)
        {
            ledPositions.push([i, 0]);
        }
        return ledPositions;
    }

    setupDevice(tuyaDevice)
    {
        this.tuyaLeds = DeviceList[tuyaDevice.deviceType].leds;
        // CORRECTION: Garder la limitation à 4 comme vous le souhaitez
        this.ledCount = (this.tuyaLeds.length > 4) ? 4 : this.tuyaLeds.length;

        this.ledNames = this.getLedNames();
        this.ledPositions = this.getLedPositions();

        device.setName(tuyaDevice.getName());
        device.setSize([this.ledCount, 1]);
        device.setControllableLeds(this.ledNames, this.ledPositions);
    }

    render(lightingMode, forcedColor, frameDelay, now)
    {
        // Mettre à jour frameDelay depuis les paramètres Signal RGB
        if (frameDelay !== undefined) {
            this.frameDelay = frameDelay;
        }
        
        if (now - this.lastRender > this.frameDelay)
        {
            this.lastRender = now;
            let RGBData = [];
            
            switch(lightingMode)
            {
                case "Canvas":
                    RGBData = this.getDeviceRGB();
                    break;
                case "Forced":
                    const rgbColor = this.hexToRGB(forcedColor);
                    for (let i = 0; i < this.ledCount; i++)
                    {
                        RGBData.push(rgbColor);
                    }
                    break;
            }

            let colorString = this.generateColorString(RGBData);
            this.tuyaDevice.sendColors(colorString);
        }
    }

    getDeviceRGB()
    {
        const RGBData = [];
    
        for(let i = 0 ; i < this.ledPositions.length; i++){
            const ledPosition = this.ledPositions[i];
            const color = device.color(ledPosition[0], ledPosition[1]);
            RGBData.push(color);
        }
    
        return RGBData;
    }

    generateColorString(colors)
    {
        let spliceLength = this.tuyaLeds.length;
        if (colors.length == 1) spliceLength = 1;

        if (spliceLength === 1)
        {
            const [h1,s1,v1] = this.rgbToHsv(colors[0]);
            let color = this.getW32FromHex(h1.toString(16), 2).toString(Hex) +
                        this.getW32FromHex(parseInt(s1 / 10).toString(16), 1).toString(Hex) +
                        this.getW32FromHex(parseInt(v1 / 10).toString(16), 1).toString(Hex);

            return color + "00000100";
        } else
        {
            let colorArray = [];

            for (let color of colors)
            {
                const [h,s,v] = this.rgbToHsv(color);
                colorArray.push(
                    this.getW32FromHex(h.toString(16), 2).toString(Hex) +
                    this.getW32FromHex(s.toString(16), 2).toString(Hex) +
                    this.getW32FromHex(v.toString(16), 2).toString(Hex)
                );
            }

            let colorString = '';

            for(let i = 1; i <= this.tuyaLeds.length; i++)
            {
                if (i <= 4) {
                    colorString += '01';
                } else if (i <= 8) {
                    colorString += '02';
                } else if (i <= 12) {
                    colorString += '03';
                } else if (i <= 16) {
                    colorString += '04';
                }
            }
    
            let spliceNumHex = this.getW32FromHex(spliceLength.toString(16), 2).toString(Hex);
            let colorValue = '0004' + colorArray.join('') + spliceNumHex + colorString;
    
            return colorValue;
        }
    }

    // CORRECTION: Méthodes utilitaires simplifiées
    hexToRGB(hex) {
        hex = hex.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        return {r, g, b};
    }

    rgbToHsv(rgb) {
        const r = rgb.r / 255;
        const g = rgb.g / 255;
        const b = rgb.b / 255;
        
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h, s, v = max;
        
        const d = max - min;
        s = max === 0 ? 0 : d / max;
        
        if (max === min) {
            h = 0;
        } else {
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }
        
        return [
            Math.round(h * 360),
            Math.round(s * 100),
            Math.round(v * 100)
        ];
    }

    getW32FromHex(hex, length) {
        while (hex.length < length) {
            hex = '0' + hex;
        }
        return hex.substring(0, length);
    }

    cleanup() {
        this.tuyaDevice = null;
    }
}
