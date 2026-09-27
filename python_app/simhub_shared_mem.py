"""
SimHub SharedMemory
Based on CrewChief work (Sparten)
No licence apply.
"""
import mmap
import os
import struct
import functools
import ctypes
from ctypes import c_float, c_char, c_int32

# maximo de setores por volta que se guarda por carro. As pistas do AC
# raramente passam de 3-4; 8 deixa folga sem desperdicar memoria (32
# carros x 8 x 4 bytes = 1 KB extra na pagina toda).
MAX_SECTORS = 8

class vec3(ctypes.Structure):
    _pack_ = 4
    _fields_ = [
        ('x', c_float),
        ('y', c_float),
        ('z', c_float),
        ]

class acsVehicleInfo(ctypes.Structure):
    _pack_ = 4
    _fields_ = [
        ('carId', c_int32),
        ('driverName', c_char * 64),
        ('carModel', c_char * 64),
        ('speedMS', c_float),
        ('bestLapMS', c_int32),
        ('lapCount', c_int32),
        ('currentLapInvalid', c_int32),
        ('currentLapTimeMS', c_int32),
        ('lastLapTimeMS', c_int32),
        ('worldPosition', vec3),
        ('isCarInPitline', c_int32),
        ('isCarInPit', c_int32  ),
        ('carLeaderboardPosition', c_int32),
        ('carRealTimeLeaderboardPosition', c_int32),
        ('spLineLength', c_float),
        ('isConnected', c_int32),
        ('suspensionDamage', c_float * 4),
        ('engineLifeLeft', c_float),
        ('tyreInflation', c_float * 4),
        # NOVO (v3): tempos de setor da ULTIMA volta completa do carro, em
        # ms. Vem de ac.getLastSplits(carId), que a API oficial da AC
        # documenta como disponivel para QUALQUER carro (nao so' o 0) --
        # ao contrario dos campos de dano acima, que a app nunca chegou a
        # preencher porque essa fisica so' existe para o carro do jogador.
        #
        # Acrescentado no FIM da struct de proposito: os campos de cima
        # ficam nos mesmos offsets de sempre, e um leitor que ainda espere
        # a struct antiga simplesmente ignora a cauda nova. E' por isso
        # tambem que o nome da pagina mudou para "acpmf_simhub_v3" mais
        # abaixo -- para nunca um leitor novo (struct maior) ir buscar um
        # mapeamento antigo (struct mais pequena) e ler lixo a seguir ao
        # fim real da memoria.
        ('lastSplitsMS', c_int32 * MAX_SECTORS),
        # quantos dos MAX_SECTORS valores acima sao validos (o que
        # ac.getLastSplits devolveu). -1/0 nos campos a mais e' lixo, nao
        # tempo -- o leitor tem de cortar por este numero.
        ('lastSplitsCount', c_int32),
    ]

      
class SPageFileSimHub(ctypes.Structure):
    _pack_ = 4
    _fields_ = [
        ('numVehicles', c_int32),
        ('focusVehicle', c_int32),
        ('serverName', c_char * 512),
        ('vehicleInfo', acsVehicleInfo * 128),
        ('acInstallPath', c_char * 512),
        ('isInternalMemoryModuleLoaded', c_int32),
        ('pluginVersion', c_char * 32)		
    ]

class SimHubShared:
    def __init__(self):
        # v3: struct maior (splits de setor no fim). Nome novo de proposito,
        # para nunca abrir por engano um mapeamento "acpmf_simhub_v2" criado
        # por uma versao antiga desta app com a struct mais pequena -- ver
        # o comentario em cima de 'lastSplitsMS'.
        self._acpmf_simhub = mmap.mmap(0, ctypes.sizeof(SPageFileSimHub), "acpmf_simhub_v3")
        self.simhub = SPageFileSimHub.from_buffer(self._acpmf_simhub)
              
    def close(self):
        self._acpmf_simhub.close()

    def __del__(self):
        self.close()
            
    def getsharedmem(self):
        return self.simhub
        
