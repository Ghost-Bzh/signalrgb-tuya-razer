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
            let color = device.color(ledPosition[0], ledPosition[1]);
            
            // CORRECTION: Vérifier et nettoyer les couleurs invalides
            if (!color || typeof color !== 'object' || 
                isNaN(color.r) || isNaN(color.g) || isNaN(color.b) ||
                color.r < 0 || color.g < 0 || color.b < 0 ||
                color.r > 255 || color.g > 255 || color.b > 255) {
                
                // Utiliser une couleur par défaut si invalide
                color = {r: 0, g: 155, b: 222}; // #009bde
            }
            
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
        // CORRECTION: Validation des entrées avant conversion
        if (!rgb || typeof rgb !== 'object' || 
            isNaN(rgb.r) || isNaN(rgb.g) || isNaN(rgb.b)) {
            console.warn("Invalid RGB values, using default:", rgb);
            return [200, 100, 87]; // Valeurs par défaut (bleu #009bde)
        }
        
        const r = Math.max(0, Math.min(255, rgb.r)) / 255;
        const g = Math.max(0, Math.min(255, rgb.g)) / 255;
        const b = Math.max(0, Math.min(255, rgb.b)) / 255;
        
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
        
        // CORRECTION: Validation des résultats avant retour
        const hue = Math.round(h * 360);
        const saturation = Math.round(s * 100);
        const value = Math.round(v * 100);
        
        // Vérifier que les valeurs sont valides
        if (isNaN(hue) || isNaN(saturation) || isNaN(value)) {
            console.warn("NaN detected in HSV conversion, using defaults");
            return [200, 100, 87]; // Valeurs par défaut
        }
        
        return [
            Math.max(0, Math.min(360, hue)),
            Math.max(0, Math.min(100, saturation)),
            Math.max(0, Math.min(100, value))
        ];
    }

    getW32FromHex(hex, length) {
        // CORRECTION: Validation et nettoyage de l'entrée hex
        if (!hex || typeof hex !== 'string') {
            hex = "0";
        }
        
        // Enlever les caractères non-hex
        hex = hex.replace(/[^0-9a-fA-F]/g, '');
        
        if (hex === '') {
            hex = "0";
        }
        
        while (hex.length < length) {
            hex = '0' + hex;
        }
        return hex.substring(0, length);
    }

    cleanup() {
        this.tuyaDevice = null;
    }
}
