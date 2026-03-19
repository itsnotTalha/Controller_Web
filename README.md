# Controller Web

## Overview
A Steam-style web controller UI with PS4-style buttons, publishing a `sensor_msgs/Joy` message to ROS via rosbridge on `/joy/controller`.

## Prerequisites
- ROS + rosbridge_server
- A web browser
- Python 3 (for a simple static server)

## Start rosbridge
Choose the correct command for your ROS version:

**ROS 1**
```
roslaunch rosbridge_server rosbridge_websocket.launch
```

**ROS 2**
```
ros2 launch rosbridge_server rosbridge_websocket_launch.xml delay_between_messages:=0.0
```

## Run the web app
From the project folder:
```
python3 -m http.server 8000
```

Open in your browser:
```
http://localhost:8000
```

## Controller Image
Add a screenshot here:

```
![Controller UI](docs/image.png)
```