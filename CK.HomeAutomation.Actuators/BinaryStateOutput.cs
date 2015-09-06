﻿using System;
using Windows.Data.Json;
using CK.HomeAutomation.Core;
using CK.HomeAutomation.Networking;
using CK.HomeAutomation.Notifications;

namespace CK.HomeAutomation.Actuators
{
    public abstract class BinaryStateOutput : BaseActuator, IBinaryStateOutputActuator
    {
        private readonly IBinaryOutput _output;

        protected BinaryStateOutput(string id, IBinaryOutput output, HttpRequestController httpRequestController,
            INotificationHandler notificationHandler) : base(id, httpRequestController, notificationHandler)
        {
            if (output == null) throw new ArgumentNullException(nameof(output));

            _output = output;
            SetStateInternal(BinaryActuatorState.Off, true, true);
        }

        public event EventHandler StateChanged; 

        public BinaryActuatorState State => _output.Read() == BinaryState.High ? BinaryActuatorState.On : BinaryActuatorState.Off;

        public void TurnOff(bool commit = true)
        {
            SetState(BinaryActuatorState.Off, commit);
        }

        public void SetState(BinaryActuatorState state, bool commit = true)
        {
            SetStateInternal(state, commit, false);
        }

        public void Toggle(bool commit = true)
        {
            SetState(State == BinaryActuatorState.On ? BinaryActuatorState.Off : BinaryActuatorState.On, commit);
        }

        protected override void ApiPost(ApiRequestContext context)
        {
            base.ApiPost(context);

            if (!context.Request.ContainsKey("state"))
            {
                return;
            }

            string action = context.Request.GetNamedString("state", "toggle");
            bool commit = context.Request.GetNamedBoolean("commit", true);

            if (action.Equals("toggle", StringComparison.OrdinalIgnoreCase))
            {
                Toggle(commit);
                ApiGet(context);

                return;
            }

            BinaryActuatorState state = (BinaryActuatorState)Enum.Parse(typeof (BinaryActuatorState), action, true);
            SetState(state, commit);
        }

        public override void ApiGet(ApiRequestContext context)
        {
            bool isOn = State == BinaryActuatorState.On;

            context.Response["state"] = JsonValue.CreateStringValue(State.ToString());
            context.Response["stateBool"] = JsonValue.CreateBooleanValue(isOn);

            base.ApiGet(context);
        }

        private void SetStateInternal(BinaryActuatorState state, bool commit, bool forceEvents)
        {
            bool stateHasChanged = state != State;

            _output.Write(state == BinaryActuatorState.On ? BinaryState.High : BinaryState.Low, commit);

            if (forceEvents || stateHasChanged)
            {
                NotificationHandler.PublishFrom(this, NotificationType.Verbose, "'{0}' set to '{1}'.", Id, State);
                StateChanged?.Invoke(this, EventArgs.Empty);
            }
        }
    }
}