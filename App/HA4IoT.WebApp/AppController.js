app.controller("AppController", ["$scope", "$http", AppController]);

function getVersion(callback) {
    $.get("cache.manifest", function (data) {
        var parser = new RegExp("# Version ([0-9|.]*)", "");
        var results = parser.exec(data);

        callback(results[1]);
    });
}

function AppController($scope, $http) {
    var c = this;

    c.isInitialized = false;
    c.appConfiguration = { showWeatherStation: true, showSensorsOverview: true, showRollerShuttersOverview: true, showMotionDetectorsOverview: true, showWindowsOverview: true }

    c.rooms = [];

    c.sensors = [];
    c.rollerShutters = [];
    c.motionDetectors = [];
    c.windows = [];

    c.activeRoom = "";
    c.errorMessage = null;
    c.version = "-";

    getVersion(function (version) {
        c.version = version;
    });

    c.notifyConfigurationLoaded = function (configuration) {
        $scope.$broadcast("configurationLoaded", { language: configuration.Controller.Language });
    };

    c.deleteNotification = function(uid) {
        postController("Service/INotificationService/Delete", { "Uid": uid });
    }

    c.generateRooms = function () {

        $http.get("/api/Configuration").success(function (data) {

            c.notifyConfigurationLoaded(data);

            $.each(data.Areas, function (areaId, area) {
                if (getConfigurationValue(area, "Hide", false)) {
                    return true;
                }

                var areaControl = {
                    id: areaId,
                    caption: getConfigurationValue(area, "Caption", areaId),
                    sortValue: getConfigurationValue(area, "SortValue", 0),
                    actuators: [],
                    automations: [],
                    onStateCount: 0
                };

                $.each(area.Components, function (componentId, component) {
                    component.id = componentId;
                    configureActuator(area, component);

                    if (component.hide) {
                        return true;
                    }

                    if (component.type === "TemperatureSensor" ||
                        component.type === "HumiditySensor") {
                        c.sensors.push(component);
                    } else if (component.type === "RollerShutter") {
                        c.rollerShutters.push(component);
                    } else if (component.type === "MotionDetector") {
                        c.motionDetectors.push(component);
                    } else if (component.type === "Window") {
                        c.windows.push(component);
                    }

                    areaControl.actuators.push(component);
                });

                c.rooms.push(areaControl);
            });

            if (c.sensors.length === 0) {
                c.appConfiguration.showSensorsOverview = false;
            }

            if (c.rollerShutters.length === 0) {
                c.appConfiguration.showRollerShuttersOverview = false;
            }

            if (c.motionDetectors.length === 0) {
                c.appConfiguration.showMotionDetectorsOverview = false;
            }

            if (c.windows.length === 0) {
                c.appConfiguration.showWindowsOverview = false;
            }

            if (c.rooms.length === 1) {
                c.setActivePanel(c.rooms[0].id);
            }

            c.pollStatus();
            c.isInitialized = true;
        });
    };

    c.setActivePanel = function (id) {
        if (c.activePanel === id) {
            c.activePanel = "";
        } else {
            c.activePanel = id;
        }

        setTimeout(function () {
            $("html, body").animate({
                scrollTop: $("#" + id).offset().top
            }, 250);
        }, 100);
    }

    c.pollStatus = function () {
        $.ajax({ method: "GET", url: "/api/status", timeout: 2500 }).done(function (data) {
            c.errorMessage = null;

            if (c.status != null && data.Meta.Hash === c.status.Meta.Hash) {
                return;
            }

            c.status = data;
            console.log("Updating UI due to state changes");

            $.each(data.Components, function (id, state) {
                c.updateStatus(id, state);
            });

            updateOnStateCounters(c.rooms);

            $scope.$apply(function () { $scope.msgs = data; });
        }).fail(function (jqXHR, textStatus, errorThrown) {
            c.errorMessage = textStatus;
        }).always(function () {
            setTimeout(function () { c.pollStatus(); }, 250);
        });
    };

    $scope.toggleState = function (actuator) {
        var newState = "On";
        if (actuator.state.State === "On") {
            newState = "Off";
        }

        invokeActuator(actuator.id, { state: newState }, function () { actuator.state.State = newState; });
    };

    $scope.invokeVirtualButton = function (actuator) {
        invokeActuator(actuator.id, {});
        c.pollStatus();
    }

    $scope.toggleIsEnabled = function (actuator) {
        var newState = !actuator.Settings.IsEnabled;

        updateActuatorSettings(actuator.id, {
            IsEnabled: newState
        }, function () {
            actuator.Settings.IsEnabled = newState;
        });
    };

    $scope.setState = function (actuator, newState) {
        invokeActuator(actuator.id, {
            state: newState
        }, function () {
            actuator.state.State = newState;
        });
    };

    c.updateStatus = function (id, state) {
        $.each(c.rooms, function (i, room) {
            $.each(room.actuators, function (i, actuator) {

                if (actuator.id === id) {
                    actuator.state = state;
                }

                return;
            });
        });
    };

    c.generateRooms();
}

function configureActuator(room, actuator) {
    actuator.sortValue = getConfigurationValue(actuator, "SortValue", 0);
    actuator.image = getConfigurationValue(actuator, "Image", "DefaultActuator");
    actuator.caption = getConfigurationValue(actuator, "Caption", actuator.id);
    actuator.overviewCaption = getConfigurationValue(actuator, "OverviewCaption", actuator.id);
    actuator.hide = getConfigurationValue(actuator, "Hide", false);
    actuator.displayVertical = getConfigurationValue(actuator, "DisplayVertical", false);
    actuator.isPartOfOnStateCounter = getConfigurationValue(actuator, "IsPartOfOnStateCounter", false);
    actuator.onStateId = getConfigurationValue(actuator, "OnStateId", "On");

    actuator.state = {};

    switch (actuator.Type) {
        case "Lamp":
            {
                actuator.template = "Views/ToggleTemplate.html";
                break;
            }
        case "Socket":
            {
                actuator.template = "Views/ToggleTemplate.html";
                break;
            }

        case "RollerShutter":
            {
                actuator.template = "Views/RollerShutterTemplate.html";
                break;
            }

        case "Window":
            {
                actuator.template = "Views/WindowTemplate.html";
                break;
            }

        case "StateMachine":
            {
                actuator.template = "Views/StateMachineTemplate.html";

                var extendedStates = [];
                $.each(actuator.SupportedStates, function (i, state) {
                    var key = "Caption." + state;
                    var stateCaption = getConfigurationValue(actuator, key, key);

                    extendedStates.push({ value: state, caption: stateCaption });
                });

                actuator.SupportedStates = extendedStates;
                break;
            }

        case "TemperatureSensor":
            {
                actuator.template = "Views/TemperatureSensorTemplate.html";
                break;
            }

        case "HumiditySensor":
            {
                actuator.template = "Views/HumiditySensorTemplate.html";
                actuator.dangerValue = getConfigurationValue(actuator, "DangerValue", 70);
                actuator.warningValue = getConfigurationValue(actuator, "WarningValue", 60);
                break;
            }

        case "MotionDetector":
            {
                actuator.template = "Views/MotionDetectorTemplate.html";
                break;
            }

        case "Button":
            {
                actuator.template = "Views/VirtualButtonTemplate.html";
                break;
            }

        case "VirtualButtonGroup":
            {
                actuator.template = "Views/VirtualButtonGroupTemplate.html";

                var extendedButtons = [];
                $.each(actuator.buttons, function (i, button) {
                    var key = "Caption." + button;
                    var buttonCaption = getConfigurationValue(actuator, key, key);

                    extendedButtons.push({ id: button, caption: buttonCaption });
                });

                actuator.buttons = extendedButtons;
                break;
            }

        default:
            {
                actuator.hide = true;
                return;
            }
    }
}

function getConfigurationValue(component, name, defaultValue) {
    if (component.Settings === undefined) {
        return defaultValue;
    }

    if (component.Settings.AppSettings === undefined) {
        return defaultValue;
    }

    if (component.Settings.AppSettings[name] === undefined) {
        return defaultValue;
    }

    return component.Settings.AppSettings[name];
}

function updateOnStateCounters(areas) {
    areas.forEach(function (area) {
        var count = 0;

        area.actuators.forEach(function (actuator) {
            if (actuator.isPartOfOnStateCounter) {
                if (actuator.onStateId === actuator.state.state) {
                    count++;
                }
            }
        });

        area.onStateCount = count;
    });
}


function postController(uri, body, successCallback) {
    // This hack is required for Safari because only one Ajax request at the same time is allowed.
    var url = "/api/" + uri + "?body=" + JSON.stringify(body);

    $.ajax({
        method: "POST",
        url: url,
        contentType: "application/json; charset=utf-8",
        timeout: 2500
    }).done(function () {
        if (successCallback != null) {
            successCallback();
        }
    }).fail(function (jqXHR, textStatus, errorThrown) {
        alert(textStatus);
    });
}

function invokeActuator(id, request, successCallback) {
    // This hack is required for Safari because only one Ajax request at the same time is allowed.
    request.ComponentId = id;

    var url = "/api/Service/IComponentService/Update?body=" + JSON.stringify(request);

    $.ajax({
        method: "POST",
        url: url,
        contentType: "application/json; charset=utf-8",
        timeout: 2500
    }).done(function () {
        if (successCallback != null) {
            successCallback();
        }
    }).fail(function (jqXHR, textStatus, errorThrown) {
        alert(textStatus);
    });
}

function updateActuatorSettings(id, request, successCallback) {
    // This hack is required for Safari because only one Ajax request at the same time is allowed.
    var url = "/api/component/" + id + "/settings?body=" + JSON.stringify(request);

    $.ajax({
        method: "POST",
        url: url,
        contentType: "application/json; charset=utf-8",
        timeout: 2500
    }).done(function () {
        if (successCallback != null) {
            successCallback();
        }
    }).fail(function (jqXHR, textStatus, errorThrown) {
        alert(textStatus);
    });
}