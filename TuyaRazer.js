import TuyaBroadcast from './TuyaBroadcast.test.js';
import TuyaController from './TuyaController.test.js';
import TuyaDevice from './TuyaDevice.test.js';
import TuyaNegotiator from './TuyaNegotiator.test.js';
import TuyaVirtualDevice from './TuyaVirtualDevice.test.js';

/* ---------- */
/*   DEVICE   */
/* ---------- */
export function Name() { return "Tuya Razer"; }
export function Version() { return "0.0.3"; }
export function Type() { return "network"; }
export function Publisher() { return "RickOfficial"; }
export function Size() { return [1, 1]; } // CORRECTION: Laissez Signal RGB ajuster automatiquement
export function DefaultPosition() {return [0, 70]; }
export function DefaultScale(){return 1.0;}

export function ControllableParameters()
{
	return [
		{"property":"lightingMode", "group":"settings", "label":"Lighting Mode", "type":"combobox", "values":["Canvas", "Forced"], "default":"Canvas"},
		{"property":"forcedColor", "group":"settings", "label":"Forced Color", "min":"0", "max":"360", "type":"color", "default":"#009bde"},
		{"property":"frameDelay", "group":"settings", "label":"Frame Delay (ms)", "min":"20", "max":"200", "type":"number", "default":"50"},
		{"property":"turnOff", "group":"settings", "label":"On shutdown", "type":"combobox", "values":["Do nothing", "Single color", "Turn device off"], "default":"Turn device off"},
        {"property":"shutDownColor", "group":"settings", "label":"Shutdown Color", "min":"0", "max":"360", "type":"color", "default":"#8000FF"}
	];
}

// CORRECTION: Variable globale nécessaire pour Signal RGB
let tuyaVirtualDevice;

export function Initialize()
{
    if (controller && controller.enabled)
    {
        // Créer l'instance dans le controller (pour multi-dispositifs)
        controller.tuyaVirtualDevice = new TuyaVirtualDevice(controller.tuyaDevice);
        
        // CORRECTION: Assigner aussi à la variable globale (pour Signal RGB)
        tuyaVirtualDevice = controller.tuyaVirtualDevice;
    }
}

export function Update()
{
    // Fonction vide pour l'instant
}

export function Render()
{
    // CORRECTION: Utiliser les variables globales directes, pas controller.xxx
    if (controller && controller.enabled && tuyaVirtualDevice)
    {
        let now = Date.now();
        
        // CORRECTION: Accès correct aux paramètres globaux
        const mode = lightingMode || "Canvas";
        const color = forcedColor || "#009bde";
        const delay = frameDelay || 50;
        
        tuyaVirtualDevice.render(mode, color, delay, now);
    }
}

export function Shutdown()
{
    if (controller && controller.tuyaVirtualDevice)
    {
        const turnOffAction = turnOff || "Turn device off";
        const shutDownColor = shutDownColor || "#8000FF";
        
        switch(turnOffAction) {
            case "Single color":
                controller.tuyaVirtualDevice.render("Forced", shutDownColor, 0, Date.now());
                break;
            case "Turn device off":
                if (controller.tuyaDevice && typeof controller.tuyaDevice.turnOff === 'function') {
                    controller.tuyaDevice.turnOff();
                }
                break;
            // "Do nothing" - ne rien faire
        }
        
        // Nettoyer les ressources
        if (controller.tuyaVirtualDevice && typeof controller.tuyaVirtualDevice.cleanup === 'function') {
            controller.tuyaVirtualDevice.cleanup();
        }
    }
}

export function Validate()
{
    return true;
}

/* ------------- */
/*   DISCOVERY   */
/* ------------- */
export function DiscoveryService()
{
    this.ipCache = {};
    this.lastPollTime = -5000;
    this.PollInterval = 5000;
    this.devicesLoaded = false;
    this.negotiator = null;

    this.Initialize = function()
    {
        this.negotiator = new TuyaNegotiator();
        this.broadcast = new TuyaBroadcast();
        this.broadcast.on('broadcast.device', this.handleTuyaDiscovery.bind(this));
    }

    this.handleTuyaDiscovery = function(data)
    {
        let deviceData = data;

        // Check if there's already a controller with this id
        if (!service.hasController(deviceData.gwId))
        {
            service.log('Creating controller for ' + deviceData.gwId);
            try {

                const deviceJson = service.getSetting(deviceData.gwId, 'data');
                if (deviceJson)
                {
                    deviceData = JSON.parse(deviceJson);
                }

                const tuyaDevice = new TuyaDevice(deviceData, this.negotiator.crc);
                const controller = new TuyaController(tuyaDevice);

                try {
                    this.negotiator.addDevice(tuyaDevice);
                } catch(ex)
                {
                    service.log(ex.message);
                }

                service.addController(controller);
                if (controller.enabled) service.announceController(controller);
            } catch(ex)
            {
                service.log(ex.message);
            }
        } else
        {
            // If there is a controller already
            let controller = service.getController(deviceData.gwId);
            // But the device detected isn't initialized
            if (!controller.tuyaDevice.initialized && controller.tuyaDevice.localKey)
            {
                this.negotiator.negotiate();
            }
        }
    }

    this.Update = function(force)
    {
        const now = Date.now();
        if (this.negotiator)
        {
            this.negotiator.handleQueue(now);
        }
    }

    this.Discovered = function(receivedPacket)
    {
        // We don't use this
    }
}
