﻿using System;
using HA4IoT.Contracts.Hardware;
using HA4IoT.Contracts.Logging;
using HA4IoT.Contracts.Networking;
using HA4IoT.Hardware.PortExpanderDrivers;
using HA4IoT.Networking;

namespace HA4IoT.Hardware.CCTools
{
    public class HSPE8InputOnly : CCToolsInputBoardBase, IBinaryInputController
    {
        public HSPE8InputOnly(DeviceId id, I2CSlaveAddress address, II2CBus bus, IHttpRequestController httpApi, ILogger logger)
            : base(id, new PCF8574Driver(address, bus), httpApi, logger)
        {
            FetchState();
        }

        public IBinaryInput GetInput(int number)
        {
            if (number < 0 || number > 7) throw new ArgumentOutOfRangeException(nameof(number));

            return GetPort(number);
        }

        public IBinaryInput this[HSPE8Pin pin] => GetInput((int)pin);
    }
}
