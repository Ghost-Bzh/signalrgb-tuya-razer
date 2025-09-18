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
        this.frameDelay = 50; // Valeur par défaut, sera mise à jour par render()
        this.lastRender = 0;
        this.ledCount = 0; // Initialisation
        this.tuyaLeds = []; // Initialisation

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
        try {
            // CORRECTION: Vérification que DeviceList[tuyaDevice.deviceType] existe
            if (!DeviceList[tuyaDevice.deviceType]) {
                console.error(`Device type ${tuyaDevice.deviceType} not found in DeviceList`);
                // Valeurs par défaut pour les barres LED
                this.tuyaLeds = Array(4).fill(0); // 4 LEDs par défaut
            } else {
                this.tuyaLeds = DeviceList[tuyaDevice.deviceType].leds;
            }
            
            // CORRECTION: Gestion plus robuste du nombre de LEDs
            this.ledCount = this.tuyaLeds.length;
            
            // Pour les barres LED, on limite généralement à 4 LEDs virtuelles
            // même si la barre physique a plus de LEDs
            if (this.ledCount > 4) {
                console.log(`Reducing LED count from ${this.ledCount} to 4 for virtual device`);
                this.ledCount = 4;
            }

            this.ledNames = this.getLedNames();
            this.ledPositions = this.getLedPositions();

            // CORRECTION: Vérification que device existe
            if (typeof device !== 'undefined') {
                device.setName(tuyaDevice.getName());
                device.setSize([this.ledCount, 1]);
                device.setControllableLeds(this.ledNames, this.ledPositions);
            } else {
                console.warn("Global 'device' object not available");
            }
        } catch (error) {
            console.error("Error in setupDevice:", error);
        }
    }

    render(lightingMode, forcedColor, frameDelay, now)
    {
        try {
            // Mettre à jour frameDelay depuis les paramètres Signal RGB
            if (frameDelay !== undefined) {
                this.frameDelay = frameDelay;
            }
            
            // CORRECTION: Vérification que now est défini
            const currentTime = now || Date.now();
            
            if (currentTime - this.lastRender > this.frameDelay)
            {
                this.lastRender = currentTime;
                let RGBData = [];
                
                switch(lightingMode)
                {
                    case "Canvas":
                        RGBData = this.getDeviceRGB();
                        break;
                    case "Forced":
                        // CORRECTION: Conversion correcte de la couleur forcée
                        const rgbColor = this.hexToRGB(forcedColor);
                        for (let i = 0; i < this.ledCount; i++)
                        {
                            RGBData.push(rgbColor);
                        }
                        break;
                    default:
                        console.warn(`Unknown lighting mode: ${lightingMode}`);
                        // Fallback to Canvas mode
                        RGBData = this.getDeviceRGB();
                        break;
                }

                // CORRECTION: Vérification que RGBData n'est pas vide
                if (RGBData.length === 0) {
                    console.warn("RGB data is empty, using default color");
                    const defaultColor = this.hexToRGB("#009bde");
                    for (let i = 0; i < this.ledCount; i++) {
                        RGBData.push(defaultColor);
                    }
                }

                // Maybe this should be in the TuyaDevice
                let colorString = this.generateColorString(RGBData);

                // Maybe this should be done by a global controller
                if (this.tuyaDevice && typeof this.tuyaDevice.sendColors === 'function') {
                    this.tuyaDevice.sendColors(colorString);
                } else {
                    console.error("TuyaDevice or sendColors method not available");
                }
            }
        } catch (error) {
            console.error("Error in render method:", error);
        }
    }

    getDeviceRGB()
    {
        const RGBData = [];
        
        try {
            // CORRECTION: Vérification que device existe et a la méthode color
            if (typeof device !== 'undefined' && typeof device.color === 'function') {
                for(let i = 0 ; i < this.ledPositions.length; i++){
                    const ledPosition = this.ledPositions[i];
                    const color = device.color(ledPosition[0], ledPosition[1]);
                    RGBData.push(color);
                }
            } else {
                // Fallback: utiliser une couleur par défaut
                console.warn("Device object not available, using default colors");
                const defaultColor = {r: 0, g: 155, b: 222}; // #009bde
                for(let i = 0 ; i < this.ledCount; i++){
                    RGBData.push(defaultColor);
                }
            }
        } catch (error) {
            console.error("Error in getDeviceRGB:", error);
        }
    
        return RGBData;
    }

    generateColorString(colors)
    {
        try {
            let spliceLength = this.tuyaLeds.length;
            if (colors.length == 1) spliceLength = 1;

            // CORRECTION: Vérification que colors n'est pas vide
            if (colors.length === 0) {
                console.warn("No colors provided, using default");
                colors = [{r: 0, g: 155, b: 222}]; // #009bde
            }

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
                    // CORRECTION: Logique améliorée pour la sélection des canaux
                    // Cette partie dépend de votre matériel spécifique
                    if (i <= 4) {
                        colorString += '01';
                    } else if (i <= 8) {
                        colorString += '02';
                    } else if (i <= 12) {
                        colorString += '03';
                    } else if (i <= 16) {
                        colorString += '04';
                    } else {
                        // Pour les LEDs au-delà de 16, utiliser le canal 1 par défaut
                        colorString += '01';
                    }
                }
        
                let spliceNumHex = this.getW32FromHex(spliceLength.toString(16), 2).toString(Hex);
                let colorValue = '0004' + colorArray.join('') + spliceNumHex + colorString;
        
                return colorValue;
            }
        } catch (error) {
            console.error("Error in generateColorString:", error);
            // Retourner une valeur par défaut en cas d'erreur
            return "000000000000000100";
        }
    }

    // CORRECTION: Ajout des méthodes manquantes
    hexToRGB(hex) {
        // Remove the # if present
        hex = hex.replace('#', '');
        
        // Parse the hex values
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        
        return {r, g, b};
    }

    rgbToHsv(rgb) {
        // Conversion RGB to HSV
        const r = rgb.r / 255;
        const g = rgb.g / 255;
        const b = rgb.b / 255;
        
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h, s, v = max;
        
        const d = max - min;
        s = max === 0 ? 0 : d / max;
        
        if (max === min) {
            h = 0; // achromatic
        } else {
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }
        
        // Convert to Tuya format (H: 0-360, S: 0-100, V: 0-100)
        return [
            Math.round(h * 360),
            Math.round(s * 100),
            Math.round(v * 100)
        ];
    }

    getW32FromHex(hex, length) {
        // Pad hex string to desired length
        while (hex.length < length) {
            hex = '0' + hex;
        }
        // Take only the required length
        return hex.substring(0, length);
    }

    // Méthode de nettoyage pour l'arrêt
    cleanup() {
        console.log("Cleaning up TuyaVirtualDevice");
        this.tuyaDevice = null;
    }
}
