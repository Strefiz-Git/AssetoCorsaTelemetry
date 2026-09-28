"""
O estado partilhado, e o unico sitio que le o jogo.

Um thread le o jogo, e varios clientes do browser leem do resultado. E' o
mesmo desenho que o `Hub` que estava no `server.py`, e a razao de ser um
so e' a mesma: **dois threads a ler a mesma coisa ao mesmo tempo dao
numeros que discordam entre si**, e um painel que mostra duas metades do
ecra que nao concordam entre si e' pior do que um painel congelado.

A diferenca e' que este Hub nao sabe o que e' um jogador. Ele recebe o
leitor de um jogo e pergunta-lhe:

    snapshot()      o estado do carro
    opponents()     os outros carros
    vivo()          o jogo esta' a correr AGORA
    estado_jogo()   a_correr / em_pausa / encerrado

E' tudo. O resto -- unidades, escalas, nomes de campo -- e' do jogo.
"""

import threading
import time

from . import jogos


class Hub:
    """Estado partilhado entre o thread que le e os threads que servem."""

    def __init__(self, jogo_id=None, rate_hz=60, opp_rate_hz=10, opcoes=None):
        self.jogo_id = jogo_id
        self.rate = 1.0 / max(1, rate_hz)
        self.opp_rate = 1.0 / max(1, opp_rate_hz)
        self.lock = threading.Lock()
        self.ultimo = {"jogo": jogo_id, "connected": False, "live": False}
        self.opponents = {"available": False, "cars": []}
        self.frames = 0
        self.leitor = None
        self.jogo = None
        self._stop = threading.Event()
        self._thread = None
        self._opcoes = opcoes or {}
        # O que correu mal na montagem, para o painel o mostrar em vez de
        # mostrar um painel vazio sem explicacao.
        self.erro = None
        if jogo_id:
            self._montar(jogo_id)

    def _montar(self, jogo_id):
        j = jogos.obter(jogo_id)
        if j is None:
            self.erro = "jogo desconhecido: %r" % (jogo_id,)
            j = jogos.JOGOS[jogos.PADRAO]
        self.jogo = j
        self.jogo_id = j.id
        try:
            self.leitor = j.criar_leitor(self._opcoes)
        except Exception as e:
            # Um leitor que nao arranca nao e' razao para o servidor nao
            # arrancar. O painel mostra "nao ligado" e a razao, que e'
            # mais util do que um erro de traceback no terminal.
            self.erro = str(e)
            self.leitor = None
            return
        # O leitor do F1 25 e' que tem de abrir o socket, e so' ele sabe
        # como. O do AC nao precisa: mapeia as paginas ao ler.
        tem_start = getattr(self.leitor, "start", None)
        if callable(tem_start):
            try:
                if not tem_start():
                    self.erro = (getattr(self.leitor, "diagnostico", lambda: {})
                                 .get("erro") or "nao foi possivel abrir o socket")
            except Exception as e:
                self.erro = str(e)

    def trocar_de_jogo(self, novo_id):
        """Muda de jogo a quente, sem reiniciar o servidor.

        E' o que faz o ecra de escolha funcionar: o utilizador escolhe um
        jogo e o painel troca sem perder a ligacao SSE. O leitor antigo e'
        fechado ANTES do novo abrir, e a ordem importa: o socket do F1 25
        fica na porta 20777, e se o novo jogo tambem precisasse dela ia
        falhar por causa do anterior.

        E o snapshot do leitor novo e' tirado AQUI, dentro da troca, e nao
        no frame seguinte. Sem isso, o `/api/state` respondia durante uns
        milissegundos com um dicionario de tres chaves, e o painel via um
        payload sem `drsDistancia`, sem `tyreTempSurface` e sem mais nada.

        A forma curta nao dava erro -- o frontend pinta o que falta a
        neutro -- e por isso era invisivel. Mas e' a Regra no 14 ao
        contrario: uma chave em falta obriga o frontend a decidir sozinho
        o que fazer com ela, e essa decisao e' sempre tomada no sitio
        errado. A troca de jogo e' o momento em que o painel tem menos
        informacao de sempre, e e' por isso que nao se pode deixar o
        payload com a forma errada precisamente nessa altura.
        """
        with self.lock:
            if novo_id == self.jogo_id and self.leitor is not None:
                return self.jogo_id
            self._parar_leitor()
            self.opponents = {"available": False, "cars": []}
            self.erro = None
            self._montar(novo_id)
            if self.leitor is not None:
                try:
                    snap = self.leitor.snapshot()
                except Exception as e:
                    snap = {"connected": False, "live": False, "erro": str(e)}
                snap.setdefault("jogo", self.jogo_id)
                snap.setdefault("estadoJogo", "encerrado")
                self.ultimo = snap
            else:
                self.ultimo = {"jogo": self.jogo_id, "connected": False,
                               "live": False}
        return self.jogo_id

    def _parar_leitor(self):
        for nome in ("stop", "close"):
            f = getattr(self.leitor, nome, None)
            if callable(f):
                try:
                    f()
                except Exception:
                    pass
        self.leitor = None

    def start(self):
        self._thread = threading.Thread(target=self._loop, daemon=True)
        self._thread.start()

    def stop(self):
        self._stop.set()
        if self._thread:
            self._thread.join(timeout=2.0)
            self._thread = None
        self._parar_leitor()

    def _loop(self):
        proxima_opp = 0.0
        while not self._stop.is_set():
            if self.leitor is None:
                # Sem leitor, nao ha' nada para pollar. Dorme e espera que
                # o `trocar_de_jogo` traga um.
                time.sleep(0.25)
                continue
            try:
                snap = self.leitor.snapshot()
            except Exception as e:
                # Um `snapshot()` que rebenta nao pode matar o fio: o
                # painel ficava cego para sempre em vez de recuperar no
                # frame seguinte. Ver a Regra no 14, pelo outro lado.
                snap = {"connected": False, "live": False, "erro": str(e)}
            estado = self.leitor.estado_jogo() if hasattr(
                self.leitor, "estado_jogo") else "a_correr"
            snap.setdefault("estadoJogo", estado)
            with self.lock:
                self.ultimo = snap
                if snap.get("connected"):
                    self.frames += 1
            # Os adversarios nao precisam da cadencia do jogador: 10 Hz
            # chega para uma tabela, e a 60 Hz seriam 24 carros a cada
            # frame (22 no formato 2025) sem ninguem precisar.
            agora = time.time()
            if agora >= proxima_opp:
                proxima_opp = agora + self.opp_rate
                try:
                    osnap = self.leitor.opponents()
                except Exception as e:
                    osnap = {"available": False, "cars": [], "erro": str(e)}
                with self.lock:
                    self.opponents = osnap
            time.sleep(self.rate)

    def get(self):
        with self.lock:
            return self.ultimo

    def get_opponents(self):
        with self.lock:
            return self.opponents

    def capacidades(self):
        """O que o jogo activo consegue mostrar. Vem do jogo, nao do
        nucleo -- e o frontend esconde o que estiver a "off"."""
        if not self.jogo:
            return {}
        return self.jogo.capacidades()

    def diagnostico(self):
        """O que correu mal, para o painel mostrar em vez de ficar vazio.

        Um painel vazio sem explicacao obriga o utilizador a adivinhar, e
        a adivinhacao mais comum ("o jogo esta' ligado?") e' a errada --
        o jogo pode estar ligado e o socket estar fechado, ou o jogo
        fechado e a pagina mapeada. Sao tres situacoes diferentes com tres
        instrucoes diferentes.
        """
        d = {"jogoSolicitado": self.jogo_id, "erro": self.erro}
        if self.leitor is not None:
            f = getattr(self.leitor, "diagnostico", None)
            if callable(f):
                try:
                    d.update(f() or {})
                except Exception:
                    pass
        if self.jogo:
            d.update(self.jogo.estado_leitor() or {})
        return d
