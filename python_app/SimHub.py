import ac
import acsys
import sys
import os.path
import platform
import configparser
import threading

# import libraries
if platform.architecture()[0] == "64bit":
    sysdir=os.path.dirname(__file__)+'/stdlib64'
else:
    sysdir=os.path.dirname(__file__)+'/stdlib'

sys.path.insert(0, sysdir)
os.environ['PATH'] = os.environ['PATH'] + ";."

import ctypes
from ctypes import *
from simhub_shared_mem import SimHubShared, MAX_SECTORS

sharedMem = SimHubShared()

# v3: acrescentados os splits de setor por carro (ver simhub_shared_mem.py)
pluginVersion = "1.1.0"

timer = 0
event = threading.Event()
stop_thread = False

def updateSharedMemory():
    global sharedMem
    sharedmem = sharedMem.getsharedmem()
    
    while not stop_thread:
        event.wait()
        event.clear()
        sharedmem.numVehicles = ac.getCarsCount()
        sharedmem.focusVehicle = ac.getFocusedCar()
        #now we'll build the slots, so we later know every single (possible) car
        carIds = range(0, min(sharedmem.numVehicles, 128), 1)
        for carId in carIds:
            #first we'll check wether there is a car for this id; as soon it returns -1
            #it's over
            if str(ac.getCarName(carId)) == '-1':
                break 			
            else:
                currentcar = sharedmem.vehicleInfo[carId];
                currentcar.carId = carId
                currentcar.driverName = ac.getDriverName(carId).encode('utf-8')
                currentcar.carModel = ac.getCarName(carId).encode('utf-8')
                currentcar.speedMS = ac.getCarState(carId, acsys.CS.SpeedMS)
                currentcar.bestLapMS = ac.getCarState(carId, acsys.CS.BestLap)
                currentcar.lapCount = ac.getCarState(carId, acsys.CS.LapCount)
                currentcar.currentLapInvalid = ac.getCarState(carId, acsys.CS.LapInvalidated)
                currentcar.currentLapTimeMS = ac.getCarState(carId, acsys.CS.LapTime)
                currentcar.lastLapTimeMS = ac.getCarState(carId, acsys.CS.LastLap)
                currentcar.worldPosition = ac.getCarState(carId, acsys.CS.WorldPosition)
                currentcar.isCarInPitline = ac.isCarInPitline(carId)
                currentcar.isCarInPit = ac.isCarInPit(carId)
                currentcar.carLeaderboardPosition = ac.getCarLeaderboardPosition(carId)
                currentcar.carRealTimeLeaderboardPosition = ac.getCarRealTimeLeaderboardPosition(carId)
                currentcar.spLineLength = ac.getCarState(carId, acsys.CS.NormalizedSplinePosition) 
                currentcar.isConnected = ac.isConnected(carId)

                # NOVO: tempos de setor da ultima volta completa. A doc
                # oficial diz "Returns -1 on failure" -- nao e' sempre uma
                # lista (ex.: carro que ainda nao completou nenhuma volta),
                # por isso o isinstance() e' obrigatorio antes de indexar.
                splits = ac.getLastSplits(carId)
                if isinstance(splits, list) and len(splits) > 0:
                    n = min(len(splits), MAX_SECTORS)
                    for i in range(n):
                        currentcar.lastSplitsMS[i] = int(splits[i])
                    currentcar.lastSplitsCount = n
                else:
                    currentcar.lastSplitsCount = 0

def acMain(ac_version):
  global appWindow,sharedMem
 
  appWindow = ac.newApp("SimHub")

  ac.setTitle(appWindow, "SimHub")
  ac.setSize(appWindow, 300, 40)

  ac.log("SimHub Was Here! damage report ?")
  ac.console("SimHub Was Here! damage report ?")

  sharedmem = sharedMem.getsharedmem()
  sharedmem.serverName = ac.getServerName().encode('utf-8')
  sharedmem.acInstallPath = os.path.abspath(os.curdir).encode('utf-8')
  sharedmem.isInternalMemoryModuleLoaded = 0
  sharedmem.pluginVersion = pluginVersion.encode('utf-8')
  
  thread = threading.Thread(target=updateSharedMemory)
  thread.daemon = True
  thread.start()
    
  return "SimHub"
  
def acShutdown():
  stop_thread = True
  event.set()

def acUpdate(deltaT):
  global timer
  timer += deltaT
  if timer > 0.025:
      event.set()
      #updateSharedMemory()
      timer = 0


