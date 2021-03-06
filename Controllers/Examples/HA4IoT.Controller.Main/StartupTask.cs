﻿using Windows.ApplicationModel.Background;
using HA4IoT.Core;

namespace HA4IoT.Controller.Main
{
    public sealed class StartupTask : IBackgroundTask
    {
        public void Run(IBackgroundTaskInstance taskInstance)
        {
            //var configurationType = typeof(Cellar.Configuration);
            var configurationType = typeof(Main.Configuration);

            var options = new ControllerOptions
            {
                StatusLedGpio = 22,
                ConfigurationType = configurationType
            };

            var controller = new Core.Controller(options);
            controller.RunAsync(taskInstance);
        }
    }
}