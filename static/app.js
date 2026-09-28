/* =========================================================================
   Assetto Corsa Telemetry - cliente
   Recebe telemetria por SSE e adversarios por um segundo canal.
   Sem dependencias externas.
   ========================================================================= */
'use strict';

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

/* ------------------------------------------------------------------ i18n */
/* As chaves do jogo e das regras que dependem dele estao nos quatro
 * idiomas, e nao por vaidade: o `auditar_frontend.py` acusa uma chave de
 * traducao num idioma e nao nos outros, e uma dica que aparece em
 * portugues e fica com o nome da chave em ingles nos outros tres.
 *
 * Repara-se que NAO HÁ NENHUM COMENTARIO DENTRO deste literal, e so' por
 * causa disto: o `auditar_frontend.py` faz `eval` do I18N em PYTHON para
 * contar as chaves, e um comentario em JavaScript -- tanto o de bloco
 * como o de linha -- nao e' Python valido. Bastou um comentario dentro do
 * literal para o teste parar de avaliar o I18N inteiro, e a mensagem que
 * ele deu foi "nao consegui avaliar o I18N": nao dizia nada sobre a causa,
 * e essa e' a falha mais enganadora que um teste pode ter. E' a Regra
 * no 9 -- quando a causa nao esta' no erro, o erro so' diz que algures
 * foi. */
const I18N = {
  'pt-PT': {
    'app.title': 'Telemetria',
    'boot.waiting': 'A aguardar o jogo',
    'boot.reading': 'A ler a telemetria directamente do jogo…',

    'menu.title': 'O que queres ver?',
    'menu.sub': 'Podes mudar a qualquer momento nas definições.',
    'menu.telemetry': 'Telemetria',
    'menu.telemetryDesc': 'Velocidade, rpm, pedais, pneus, combustível',
    'menu.leaderboard': 'Leaderboard',
    'menu.leaderboardDesc': 'Classificação de todos os carros',
    'menu.both': 'Misto',
    'menu.bothDesc': 'Telemetria e leaderboard ao mesmo tempo',
    'set.title': 'Definições', 'set.mode': 'Vista', 'set.units': 'Unidades',
    'set.close': 'Fechar', 'set.menu': 'Menu', 'set.open': 'Definições',
    'set.lang': 'Idioma', 'set.map': 'Mapa', 'set.mapOn': 'Mostrar',
    'set.mapOff': 'Esconder', 'set.clearMap': 'Apagar o mapa desenhado',
    'set.mapViewFull': 'Pista inteira', 'set.mapViewRel': 'Vista relativa',
    'set.mapViewWhy': 'Na vista relativa o mapa fica centrado no carro e o zoom acompanha a velocidade: paradoxo, abre; a acelerar, fecha. É o que se quer quando se está a conduzir.',
    'set.acPathWhy': 'Para o mapa aparecer completo desde o início (em vez de descoberto a conduzir), indica a pasta onde o Assetto Corsa está instalado.',
    'set.acPathSave': 'Guardar', 'set.mapFlipX': 'Inverter X', 'set.mapFlipZ': 'Inverter Z',
    'set.acPathAuto': 'Detetada automaticamente: {p}', 'set.acPathOk': 'Pasta válida: {p}',
    'set.acPathBad': 'Não encontrei "content/tracks" nessa pasta — confirma o caminho.',
    'set.acPathNone': 'Ainda não configurada. Sem ela, o mapa é desenhado a conduzir.',
    'set.acPathSaving': 'A verificar...',
    'set.drsZone': 'Zona de DRS', 'set.drsMark': 'Marcar a zona', 'set.drsMarking': 'A marcar... clica para parar', 'set.drsClear': 'Apagar a zona de DRS',
    'set.drsZoneWhy': 'O jogo nao diz onde acaba a zona: o drsAvailable fica a 1 quase sempre, por isso o mapa teria a pista toda a verde. Marca-se a zona a conduzir, com o tracado real.',
    'set.drsVerdictZona': 'O drsAvailable marca a zona nesta pista - pintado automaticamente.',
    'set.drsVerdictSempre': 'O drsAvailable ficou ligado quase sempre nesta pista, por isso NAO marca a zona. Pinta-se a mao.',
    'set.drsVerdictNunca': 'O drsAvailable nunca ficou ligado nesta pista, por isso NAO marca a zona.',
    'set.drsAMedir': 'A medir o drsAvailable numa volta inteira...',
    'set.fps': 'Envio de dados', 'set.about': 'Sobre',
    'set.aboutBody': 'Telemetria lida directamente da memória do Assetto Corsa, e a nossa própria app Python para os adversários.',
    'drs.short': 'DRS', 'gear.label': 'CAIXA', 'unit.kmh': 'km/h', 'unit.ms': 'm/s',
    'unit.mph': 'mph', 'unit.rpm': 'rpm',
    'ers.short': 'ERS', 'pit.short': 'PIT',
    'state.lim': 'LIM',
    'map.title': 'MAPA DA PISTA', 'pedals.title': 'PEDAIS',
    'map.vazio': 'Sem mapa ainda. Conduz uma volta e ele desenha-se sozinho.',
    'wheel.title': 'VOLANTE', 'wheel.note': 'Angulo do volante, de -1 a 1. O alcance do valor esta'
    + ' por confirmar a conduzir.',
    'map.drsKey': 'zona de DRS',
    'pedals.throttle': 'ACEL.', 'pedals.brake': 'TRAVA',
    'pedals.clutch': 'EMBRAIAGEM', 'pedals.handbrake': 'FREIO DE MÃO',
    'pedals.pequeno': 'pouco espaco', 'pedals.agora': 'agora',
    'laps.title': 'VOLTAS', 'laps.current': 'ATUAL', 'laps.best': 'MELHOR',
    'laps.last': 'ANTERIOR', 'laps.delta': 'DELTA',
    'tyres.title': 'PNEUS E TRAVÕES',
    'tyres.life': 'Vida do pneu',
    'tyres.measuring': 'a medir', 'tyres.perLap': 'por volta', 'tyres.needTwoLaps': 'Faltam 2 voltas para estimar', 'tyres.lapsOnThisSet': 'voltas neste jogo',
    'tyres.surface': 'Temperatura da banda. O número grande é o do núcleo, que é o que o jogo mostra.',
    'tyres.gripWhat': 'Aderência do pneu, de 0 a 100, em que 100 é a máxima. Não é desgaste: o campo chama-se `tyreWear` mas mede a aderência, e por isso desce só 0,45 por volta — a aderência muda devagar. O desgaste que o HUD do Content Manager mostra é outra grandeza, e os dois não se convertem.', 'tyres.pressTitle': 'Pressão real, em psi. O jogo mostra o desvio para uma nominal que não é publicada.',
  'tyres.gastoWhat': 'Desgaste do pneu, de 0 a 100, em que 100 é o fim da vida. Este número é quanto JÁ FOI USADO, e 0 é um pneu novo. O MFD do jogo mostra a mesma percentagem, e é medido: com 2 voltas de 21 o jogo dava 10. No Assetto Corsa este mesmo campo é outra coisa — é aderência, não desgaste.',
    'tyres.lifeNote': 'Estimativa a partir do desgaste já medido neste stint. O Assetto Corsa não publica a vida do composto, e o desgaste que publica é lento demais para dar um número fiável: se aparecer, é porque o valor desta vez é plausível.',
    'tyres.notWear': 'não dá',
    'tyres.notWearWhy': 'O desgaste que o jogo publica é lento demais para um stint real: 0,17% ao fim de duas voltas dariam 588 voltas de vida. Não dá para prever a partir dele.',
    'brakes.title': 'TRAVÕES', 'brakes.bias': 'B. TRAVA',
    'brakes.biasTitle': 'Distribuição da travagem, em percentagem do travão total. Medido 0,58 num TS040 sem nada mexido. O HUD do Content Manager mostra o mesmo campo e ajusta-o de 0,5 em 0,5.',
    'tyres.damage': 'DANOS',
    'tyres.suspDamage': 'SUSPENSÃO', 'tyres.engineDamage': 'MOTOR',
    'fuel.title': 'COMBUSTÍVEL',
    'wx.air': 'AR', 'wx.road': 'PISTA', 'wx.wind': 'VENTO', 'wx.density': 'DENSIDADE', 'wx.grip': 'ADERENCIA', 'unit.c': '°C',
    "wx.rain": "CHUVA",
    "wx.seco": "SECO", "wx.chiada": "CHIADA", "wx.chiadaForte": "CHIADA FORTE", "wx.chuvaFraca": "CHUVA FRACA", "wx.chuva": "CHUVA", "wx.chuvaForte": "CHUVA FORTE", "wx.neve": "NEVE", "wx.trovoada": "TROVOADA", "wx.trovoadaForte": "TROVOADA FORTE", "wx.furacao": "FURACÃO", "wx.rotuloTempo": "Tempo", "wx.ventoso": "VENTOSO", "wx.aguaceiro": "AGUACEIRO", "wx.tornado": "TORNADO", "wx.topoDoCartao": "o topo do que o jogo tem",
    "wx.rainTitle": "Intensidade da chuva, pela API do jogo. Vem de ac.ext_rainParams() e so' existe com o Custom Shaders Patch.",
    "wx.rainUnknown": "A app nao consegue ler o clima. A intensidade da chuva vem do Custom Shaders Patch, que precisa de expor ac.ext_rainParams() ao Python. Sem isso o numero seria 0, e 0 significa 'nao chove', que nao e' a verdade.",
    'fuel.inTank': 'Na reserva', 'fuel.lapsLeft': 'Voltas',
    'fuel.ambient': 'Ar / pista', 'fuel.penalty': 'Penalidade',
    'fuel.ersUsed': 'ERS na volta', 'fuel.none': 'nenhuma',
    'fuel.measuring': 'a medir',
    'fuel.lapsWhy': 'Voltas que o combustivel que resta deve chegar, ao ritmo medio medido. O jogo nao diz quantos litros se gasta por volta, por isso mede-se a diferenca entre o inicio e o fim de cada volta.',
    'fuel.oneLapWhy': 'Media de uma so' + '\u2019' + ' volta. Com duas ou mais deixa de ser uma amostra de uma e passa a ser um ritmo.',
    'fuel.avisoWhy': 'Abaixo de 1,5 voltas: ja' + '\u2019' + ' nao da' + '\u2019' + ' para sair do box, fazer a volta e voltar com folga.',
    'fuel.criticoWhy': 'Abaixo de 1 volta: nao ha' + '\u2019' + ' margem nenhuma. Ao ritmo medio, o que resta acaba antes de a volta acabar.',
    'fuel.avisoWhyPct': 'Abaixo ou igual a 15% do depósito. A percentagem não depende de nenhuma medição, ao contrário das voltas, que só existem depois de uma volta fechada.',
    'lb.title': 'CLASSIFICAÇÃO', 'lb.telTitle': 'TEU CARRO',
    'lb.pos': 'P', 'lb.name': 'PILOTO', 'lb.lap': 'VOLTA',
    "lb.posTitle": "Posi\u00e7\u00e3o oficial do Assetto Corsa. A lista mostra a posi\u00e7\u00e3o ao vivo, que conta as voltas por fechar; a oficial so' conta voltas completas e por isso vai atrasada no in\u00edcio de uma corrida.",
    'lb.time': 'TEMPO', 'lb.best': 'MELHOR', 'lb.gap': 'INT.',
    'lb.intTitle': 'Tempo até ao carro da frente. Na mesma volta é o tempo exacto que ele levou a passar pelo mesmo ponto da pista; fora isso é uma estimativa pelo ritmo da última volta dele.',
    'lb.penalty': 'Penalidade', 'lb.drs': 'DRS',
    'foot.src.ac': 'memória partilhada, sem SimHub',
    'foot.src.f125': 'UDP, sem SimHub',
    'status.live': 'AO VIVO', 'status.paused': 'EM PAUSA',
    'status.closed': 'JOGO ENCERRADO', 'status.stale': 'últimos valores',
    'sector': 'SETOR', 'lapCount': 'VOLTA',
    'drs.off': 'OFF', 'drs.avail': 'LIVRE', 'drs.open': 'ABERTO',
    'opp.waiting': 'A aguardar os dados dos adversários.',
    'opp.how': 'A app <b>AssettoCorsaTelemetry</b> escreve a página de memória com os carros, e é a nossa — vem na pasta <b>python_app</b> do projecto. Copia-a para <b>assettocorsa/apps/python/actelemetry_strefiz/</b> e liga-a em Content Manager (<b>Settings → Python Apps → AssettoCorsaTelemetry</b>). Confirma que arrancou pelo log do AC, e que o AC está numa sessão com outros carros.',
    'opp.errTitle': 'A app está a correr, mas uma leitura está a falhar.',
    'opp.err': 'Não é a app estar desligada — por isso não a desligues. A leitura acima é o que está a falhar dentro do jogo; o log do AC tem mais.',
    'opp.none': 'Nenhum carro na sessão.',
    'lb.pit': 'PIT',
    'jog.title':
      'Jogo',
    'jog.sub':
      'Podes mudar a qualquer momento, aqui ou nas definições.',
    'jog.why':
      'O jogo decide o que o painel consegue mostrar.',
    'jog.abrir':
      'Trocar de jogo',
    'jog.semJogos':
      'O servidor não respondeu com a lista de jogos. Reinicia-o e volta a abrir esta página.',
    'jog.precisaInstalar':
      'Precisa da app instalada no jogo',
    'jog.divergencia':
      'O servidor arrancou para <b>{jogo}</b> e este browser ficou com <b>{outro}</b> da última vez. Escolhe qual queres.',
    'jog.escolher':
      'Escolher o jogo',
    'abs.off':
      'desligado',
    'drs.on':
      'ligado',
    'drs.disp':
      'disponível',
    'f1.embraiagemDica':
      'O F1 25 manda a embraiagem de 0 a 100, com 100 a embraiada. O painel mostra o inverso: quanto está solta.',
    'f1.volanteDica':
      'O F1 25 manda o volante normalizado, de −1 a 1, com o limite na documentação.',
    'f1.absDica':
      'O F1 25 diz só ligado ou desligado. Não há percentagem, e mostrar uma seria inventar um número que o jogo não dá.',
    'f1.tcDica':
      'No F1 25 o controle de tração é um modo: desligado, médio ou cheio. Não é um nível de 0 a 100%.',
    'f1.tcMedio':
      'médio',
    'f1.tcCheio':
      'cheio',
    'f1.drsDica':
      'O F1 25 diz quantos metros faltam para a zona de DRS. O Assetto Corsa não diz, e por isso lá a zona é medida a conduzir.',
    'f1.vidaSemDados':
      'O pacote de pneus ainda não chegou. O jogo só o manda de poucos em poucos segundos.',
    'f1.vidaDica':
      'Voltas que faltam, lidas do jogo. No Assetto Corsa este número não existe e é estimado.',
    'f1.combustivelDica':
      'O F1 25 manda o combustível em quilos. O Assetto Corsa manda litros, e 42,5 kg não são 42,5 L.',
    'ac.embraiagemDica':
      'O Assetto Corsa manda a embraiagem de 0 a 1, e 1,0 é EMBRAIADA — a documentação diz “pedal” e não é. O painel mostra o inverso.',
    'ac.volanteDica':
      'O ângulo da roda, em radianos. O limite não está escrito em lado nenhum, e por isso não há barra.',
    'ac.absDica':
      'O nível a que o ABS está a trabalhar, medido em 0,13 durante 4502 amostras de travagens duras. Por isso mostra uma percentagem e não ligado/desligado.',
    'ac.tcDica':
      'O nível a que o controle de tração está a trabalhar.',
    'ac.drsDica':
      'O Assetto Corsa não diz onde é a zona de DRS. O painel mede o flag durante uma volta inteira, porque o mesmo flag esteve a 1 em 98,9% do traçado num carro e a 1 em 18,5% noutro.',
    'ac.combustivelDica':
      'O Assetto Corsa manda o combustível em litros.',
  },
  'pt-BR': {
    'app.title': 'Telemetria', 'boot.waiting': 'Aguardando o jogo',
    'boot.reading': 'Lendo a telemetria direto do jogo…',

    'menu.title': 'O que você quer ver?', 'menu.sub': 'Dá para mudar a qualquer momento nas configurações.',
    'menu.telemetry': 'Telemetria', 'menu.telemetryDesc': 'Velocidade, rpm, pedais, pneus, combustível',
    'menu.leaderboard': 'Leaderboard', 'menu.leaderboardDesc': 'Classificação de todos os carros',
    'menu.both': 'Misto', 'menu.bothDesc': 'Telemetria e leaderboard ao mesmo tempo',
    'set.title': 'Configurações', 'set.mode': 'Tela', 'set.units': 'Unidades',
    'set.close': 'Fechar', 'set.menu': 'Menu', 'set.open': 'Configurações',
    'set.lang': 'Idioma', 'set.map': 'Mapa', 'set.mapOn': 'Mostrar',
    'set.mapOff': 'Esconder', 'set.clearMap': 'Apagar o mapa desenhado',
    'set.mapViewFull': 'Pista inteira', 'set.mapViewRel': 'Vista relativa',
    'set.mapViewWhy': 'Na vista relativa o mapa fica centralizado no carro e o zoom acompanha a velocidade: parado, abre; acelerando, fecha. É o que se quer quando se está dirigindo.',
    'set.acPathWhy': 'Para o mapa aparecer completo desde o início (em vez de descoberto dirigindo), informe a pasta onde o Assetto Corsa está instalado.',
    'set.acPathSave': 'Salvar', 'set.mapFlipX': 'Inverter X', 'set.mapFlipZ': 'Inverter Z',
    'set.acPathAuto': 'Detectada automaticamente: {p}', 'set.acPathOk': 'Pasta válida: {p}',
    'set.acPathBad': 'Não encontrei "content/tracks" nessa pasta — confira o caminho.',
    'set.acPathNone': 'Ainda não configurada. Sem ela, o mapa é desenhado dirigindo.',
    'set.acPathSaving': 'Verificando...',
    'set.drsZone': 'Zona de DRS', 'set.drsMark': 'Marcar a zona', 'set.drsMarking': 'Marcando... clique para parar', 'set.drsClear': 'Apagar a zona de DRS',
    'set.drsZoneWhy': 'O jogo nao diz onde termina a zona: o drsAvailable fica em 1 quase sempre, por isso o mapa teria a pista toda verde. Marque a zona dirigindo, com o tracado real.',
    'set.drsVerdictZona': 'O drsAvailable marca a zona nesta pista - pintado automaticamente.',
    'set.drsVerdictSempre': 'O drsAvailable ficou ligado quase sempre nesta pista, por isso NAO marca a zona. Pinta-se na mao.',
    'set.drsVerdictNunca': 'O drsAvailable nunca ficou ligado nesta pista, por isso NAO marca a zona.',
    'set.drsAMedir': 'Medindo o drsAvailable numa volta inteira...',
    'set.fps': 'Envio de dados', 'set.about': 'Sobre',
    'set.aboutBody': 'Telemetria lida direto da memória do Assetto Corsa, e o nosso próprio app Python para os adversários.',
    'drs.short': 'DRS', 'gear.label': 'MARCHA', 'unit.kmh': 'km/h', 'unit.ms': 'm/s',
    'unit.mph': 'mph', 'unit.rpm': 'rpm', 'ers.short': 'ERS', 'pit.short': 'BOX',
    'state.lim': 'LIM',
    'map.title': 'MAPA DA PISTA', 'pedals.title': 'PEDAIS',
    'map.vazio': 'Sem mapa ainda. Conduz uma volta e ele se desenha sozinho.',
    'wheel.title': 'VOLANTE', 'wheel.note': 'Angulo do volante, de -1 a 1. O alcance do valor esta'
    + ' por confirmar dirigindo.',
    'map.drsKey': 'zona de DRS',
    'pedals.throttle': 'ACEL.', 'pedals.brake': 'FREIO',
    'pedals.clutch': 'EMBREAGEM', 'pedals.handbrake': 'FREIO DE MÃO',
    'pedals.pequeno': 'pouco espaco', 'pedals.agora': 'agora',
    'laps.title': 'VOLTAS', 'laps.current': 'ATUAL', 'laps.best': 'MELHOR',
    'laps.last': 'ANTERIOR', 'laps.delta': 'DELTA',
    'tyres.title': 'PNEUS E FREIOS',
    'tyres.notWear': 'não dá',
    'tyres.notWearWhy': 'O desgaste que o jogo publica é lento demais para um stint real: 0,17% ao fim de duas voltas dariam 588 voltas de vida. Não dá para prever a partir dele.',
    'tyres.life': 'Vida do pneu',
    'tyres.measuring': 'medindo', 'tyres.perLap': 'por volta', 'tyres.needTwoLaps': 'Faltam 2 voltas para estimar', 'tyres.lapsOnThisSet': 'voltas neste stint',
    'tyres.surface': 'Temperatura da banda. O número grande é o do núcleo, que é o que o jogo mostra.',
    'tyres.gripWhat': 'Aderência do pneu, de 0 a 100, em que 100 é a máxima. Não é desgaste: o campo chama-se `tyreWear` mas mede a aderência, e por isso desce só 0,45 por volta — a aderência muda devagar. O desgaste que o HUD do Content Manager mostra é outra grandeza, e os dois não se convertem.', 'tyres.pressTitle': 'Pressão real, em psi. O jogo mostra o desvio para uma nominal que não é publicada.',
  'tyres.gastoWhat': 'Desgaste do pneu, de 0 a 100, em que 100 é o fim da vida. Este número é quanto JÁ FOI USADO, e 0 é um pneu novo. O MFD do jogo mostra a mesma percentagem, e é medido: com 2 voltas de 21 o jogo dava 10. No Assetto Corsa este mesmo campo é outra coisa — é aderência, não desgaste.',
    'tyres.lifeNote': 'Estimativa feita do desgaste que já aconteceu neste stint, não de uma tabela do jogo: o Assetto Corsa não publica a vida do pneu. Depois de duas voltas medidas o número já significa alguma coisa; antes disso é um palpite.',
    'brakes.title': 'FREIOS', 'brakes.bias': 'B. FREIO',
    'brakes.biasTitle': 'Distribuição da frenagem, em porcentagem do freio total. Medido 0,58 num TS040 sem nada mexido. O HUD do Content Manager mostra o mesmo campo e ajusta de 0,5 em 0,5.',
    'tyres.damage': 'AVARIAS',
    'tyres.suspDamage': 'SUSPENSÃO', 'tyres.engineDamage': 'MOTOR',
    'fuel.measuring': 'a medir',
    'fuel.lapsWhy': 'Voltas que o combustivel restante deve alcancar, no ritmo medio medido. O jogo nao diz quantos litros sao usados por volta, por isso mede-se a diferenca entre o inicio e o fim de cada volta.',
    'fuel.oneLapWhy': 'Media de uma so' + '\u2019' + ' volta. Com duas ou mais deixa de ser uma amostra de uma e passa a ser um ritmo.',
    'fuel.avisoWhy': 'Abaixo de 1,5 voltas: ja' + '\u2019' + ' nao da' + '\u2019' + ' para sair do box, fazer a volta e voltar com folga.',
    'fuel.avisoWhyPct': 'Abaixo ou igual a 15% do tanque. A porcentagem não depende de nenhuma medição, ao contrário das voltas, que só existem depois de uma volta fechada.',
    'fuel.criticoWhy': 'Abaixo de 1 volta: nao ha' + '\u2019' + ' margem nenhuma. No ritmo medio, o que resta acaba antes de a volta terminar.',
    'fuel.title': 'COMBUSTÍVEL',
    'wx.air': 'AR', 'wx.road': 'PISTA', 'wx.wind': 'VENTO', 'wx.density': 'DENSIDADE', 'wx.grip': 'ADERENCIA', 'unit.c': '°C',
    "wx.rain": "CHUVA",
    "wx.seco": "SECO", "wx.chiada": "CHIADA", "wx.chiadaForte": "CHIADA FORTE", "wx.chuvaFraca": "CHUVA FRACA", "wx.chuva": "CHUVA", "wx.chuvaForte": "CHUVA FORTE", "wx.neve": "NEVE", "wx.trovoada": "TROVOADA", "wx.trovoadaForte": "TROVOADA FORTE", "wx.furacao": "FURACÃO", "wx.rotuloTempo": "Tempo", "wx.ventoso": "VENTOSO", "wx.aguaceiro": "AGUACEIRO", "wx.tornado": "TORNADO", "wx.topoDoCartao": "o topo do que o jogo tem",
    "wx.rainTitle": "Intensidade da chuva, pela API do jogo. Vem de ac.ext_rainParams() e so' existe com o Custom Shaders Patch.",
    "wx.rainUnknown": "A app nao consegue ler o clima. A intensidade da chuva vem do Custom Shaders Patch, que precisa de expor ac.ext_rainParams() ao Python. Sem isso o numero seria 0, e 0 significa 'nao chove', que nao e' a verdade.",
    'fuel.inTank': 'No tanque', 'fuel.lapsLeft': 'Voltas',
    'fuel.ambient': 'Ar / pista', 'fuel.penalty': 'Penalty',
    'fuel.ersUsed': 'ERS na volta', 'fuel.none': 'nenhuma',
    'lb.title': 'CLASSIFICAÇÃO', 'lb.telTitle': 'SEU CARRO',
    "lb.posTitle": "Posi\u00e7\u00e3o oficial do Assetto Corsa. A lista mostra a posi\u00e7\u00e3o ao vivo, que conta as voltas por fechar; a oficial s\u00f3 conta voltas completas e por isso fica atrasada no come\u00e7o de uma corrida.",
    'lb.pos': 'P', 'lb.name': 'PILOTO', 'lb.lap': 'VOLTA',
    'lb.time': 'TEMPO', 'lb.best': 'MELHOR', 'lb.gap': 'INT.',
    'lb.intTitle': 'Tempo até ao carro da frente. Na mesma volta é o tempo exacto que ele levou a passar pelo mesmo ponto da pista; fora isso é uma estimativa pelo ritmo da última volta dele.',
    'lb.penalty': 'Penalty', 'lb.drs': 'DRS',
    'foot.src.ac': 'memória compartilhada, sem SimHub',
    'foot.src.f125': 'UDP, sem SimHub',
    'status.live': 'AO VIVO', 'status.paused': 'EM PAUSA',
    'status.closed': 'JOGO ENCERRADO', 'status.stale': 'últimos valores',
    'sector': 'SETOR', 'lapCount': 'VOLTA',
    'drs.off': 'OFF', 'drs.avail': 'LIVRE', 'drs.open': 'ABERTO',
    'opp.waiting': 'Aguardando os dados dos adversários.',
    'opp.errTitle': 'O app está rodando, mas uma leitura está falhando.',
    'opp.err': 'Não é o app estar desligado — por isso não o desligue. A leitura acima é o que está falhando dentro do jogo; o log do AC tem mais.',
    'opp.how': 'O app <b>AssettoCorsaTelemetry</b> escreve a página de memória com os carros, e é o nosso — vem na pasta <b>python_app</b> do projecto. Copie-o para <b>assettocorsa/apps/python/actelemetry_strefiz/</b> e ative-o no Content Manager (<b>Settings → Python Apps → AssettoCorsaTelemetry</b>). Confirme que subiu pelo log do AC, e que o AC está numa sessão com outros carros.',
    'opp.none': 'Nenhum carro na sessão.', 'lb.pit': 'BOX',
    'jog.title':
      'Jogo',
    'jog.sub':
      'Você pode mudar quando quiser, aqui ou nas configurações.',
    'jog.why':
      'O jogo define o que o painel consegue mostrar.',
    'jog.abrir':
      'Trocar de jogo',
    'jog.semJogos':
      'O servidor não respondeu com a lista de jogos. Reinicie-o e abra esta página de novo.',
    'jog.precisaInstalar':
      'Precisa do app instalado no jogo',
    'jog.divergencia':
      'O navegador se acordou con <b>{outro}</b> de la última vez, pero el servidor arrancó para <b>{jogo}</b>. Elige cuál quieres.',
    'jog.escolher':
      'Elegir el juego',
    'abs.off':
      'desligado',
    'drs.on':
      'ligado',
    'drs.disp':
      'disponível',
    'f1.embraiagemDica':
      'O F1 25 manda a embreagem de 0 a 100, com 100 engatada. O painel mostra o contrário.',
    'f1.volanteDica':
      'O F1 25 manda o volante normalizado, de −1 a 1.',
    'f1.absDica':
      'O F1 25 diz só ligado ou desligado. Não há porcentual, e mostrar um seria inventar um número.',
    'f1.tcDica':
      'No F1 25 o controle de tração é um modo: desligado, médio ou cheio.',
    'f1.tcMedio':
      'médio',
    'f1.tcCheio':
      'cheio',
    'f1.drsDica':
      'O F1 25 diz quantos metros faltam para a zona de DRS.',
    'f1.vidaSemDados':
      'O pacote de pneus ainda não chegou.',
    'f1.vidaDica':
      'Voltas que faltam, lidas do jogo.',
    'f1.combustivelDica':
      'O F1 25 manda o combustível em quilos. O Assetto Corsa manda litros.',
    'ac.embraiagemDica':
      'O Assetto Corsa manda a embreagem de 0 a 1, e 1,0 é ENGATADA. O painel mostra o contrário.',
    'ac.volanteDica':
      'O ângulo da roda, em radianos. O limite não está escrito em lugar nenhum.',
    'ac.absDica':
      'O nível em que o ABS está trabalhando, medido em 0,13. Por isso mostra uma porcentagem.',
    'ac.tcDica':
      'O nível em que o controle de tração está trabalhando.',
    'ac.drsDica':
      'O Assetto Corsa não diz onde é a zona de DRS. O painel mede o flag durante uma volta inteira.',
    'ac.combustivelDica':
      'O Assetto Corsa manda o combustível em litros.',
  },
  'es': {
    'app.title': 'Telemetría', 'boot.waiting': 'Esperando al juego',
    'boot.reading': 'Leyendo la telemetría directamente del juego…',

    'menu.title': '¿Qué quieres ver?', 'menu.sub': 'Puedes cambiarlo cuando quieras en los ajustes.',
    'menu.telemetry': 'Telemetría', 'menu.telemetryDesc': 'Velocidad, rpm, pedales, neumáticos, combustible',
    'menu.leaderboard': 'Leaderboard', 'menu.leaderboardDesc': 'Clasificación de todos los coches',
    'menu.both': 'Mixto', 'menu.bothDesc': 'Telemetría y leaderboard a la vez',
    'set.title': 'Ajustes', 'set.mode': 'Vista', 'set.units': 'Unidades',
    'set.close': 'Cerrar', 'set.menu': 'Menú', 'set.open': 'Ajustes',
    'set.lang': 'Idioma', 'set.map': 'Mapa', 'set.mapOn': 'Mostrar',
    'set.mapOff': 'Ocultar', 'set.clearMap': 'Borrar el mapa dibujado',
    'set.mapViewFull': 'Pista completa', 'set.mapViewRel': 'Vista relativa',
    'set.mapViewWhy': 'En la vista relativa el mapa se centra en el coche y el zoom sigue a la velocidad: parado, se abre; acelerando, se cierra. Es lo que se quiere mientras se conduce.',
    'set.acPathWhy': 'Para que el mapa aparezca completo desde el principio (en vez de descubrirse conduciendo), indica la carpeta donde está instalado Assetto Corsa.',
    'set.acPathSave': 'Guardar', 'set.mapFlipX': 'Invertir X', 'set.mapFlipZ': 'Invertir Z',
    'set.acPathAuto': 'Detectada automáticamente: {p}', 'set.acPathOk': 'Carpeta válida: {p}',
    'set.acPathBad': 'No encontré "content/tracks" en esa carpeta — revisa la ruta.',
    'set.acPathNone': 'Aún no configurada. Sin ella, el mapa se dibuja conduciendo.',
    'set.acPathSaving': 'Comprobando...',
    'set.drsZone': 'Zona de DRS', 'set.drsMark': 'Marcar la zona', 'set.drsMarking': 'Marcando... pulsa para parar', 'set.drsClear': 'Borrar la zona de DRS',
    'set.drsZoneWhy': 'El juego no dice donde acaba la zona: el drsAvailable se queda en 1 casi siempre, por eso el mapa tendria el circuito todo en verde. Marcala conduciendo, con el trazado real.',
    'set.drsVerdictZona': 'El drsAvailable marca la zona en esta pista - pintado automaticamente.',
    'set.drsVerdictSempre': 'El drsAvailable se quedo encendido casi siempre en esta pista, asi que NO marca la zona. Se pinta a mano.',
    'set.drsVerdictNunca': 'El drsAvailable nunca se encendio en esta pista, asi que NO marca la zona.',
    'set.drsAMedir': 'Midiendo el drsAvailable en una vuelta entera...',
    'set.fps': 'Envío de datos', 'set.about': 'Acerca de',
    'set.aboutBody': 'Telemetría leída directamente de la memoria del Assetto Corsa, y es nuestra propia app de Python para los rivales.',
    'drs.short': 'DRS', 'gear.label': 'MARCHA', 'unit.kmh': 'km/h', 'unit.ms': 'm/s',
    'unit.mph': 'mph', 'unit.rpm': 'rpm', 'ers.short': 'ERS', 'pit.short': 'PIT',
    'state.lim': 'LIM',
    'map.title': 'MAPA DE LA PISTA', 'pedals.title': 'PEDALES',
    'map.vazio': 'Sin mapa todavia. Conduce una vuelta y se dibuja solo.',
    'wheel.title': 'VOLANTE', 'wheel.note': 'Angulo del volante, de -1 a 1. El alcance del valor esta'
    + ' por confirmar conduciendo.',
    'map.drsKey': 'zona de DRS',
    'pedals.throttle': 'ACEL.', 'pedals.brake': 'FRENO',
    'pedals.clutch': 'EMBRAGUE', 'pedals.handbrake': 'FRENO DE MANO',
    'pedals.pequeno': 'poco espacio', 'pedals.agora': 'ahora',
    'laps.title': 'VUELTAS', 'laps.current': 'ACTUAL', 'laps.best': 'MEJOR',
    'laps.last': 'ANTERIOR', 'laps.delta': 'DELTA',
    'tyres.title': 'NEUMÁTICOS Y FRENOS',
    'tyres.life': 'Vida del neumático',
    'tyres.measuring': 'midiendo', 'tyres.perLap': 'por vuelta', 'tyres.needTwoLaps': 'Faltan 2 vueltas para poder estimar', 'tyres.lapsOnThisSet': 'vueltas en este stint',
    'tyres.surface': 'Temperatura de la banda. El número grande es el del núcleo, que es el que muestra el juego.',
    'tyres.gripWhat': 'Adherencia del neumático, de 0 a 100, donde 100 es la máxima. No es desgaste: el campo se llama `tyreWear` pero mide la adherencia, y por eso baja solo 0,45 por vuelta — la adherencia cambia despacio. El desgaste que muestra el HUD del Content Manager es otra magnitud, y los dos no se convierten.', 'tyres.pressTitle': 'Presión real, en psi. El juego muestra la desviación respecto a una nominal que no se publica.',
  'tyres.gastoWhat': 'Desgaste del neumático, de 0 a 100, donde 100 es el final de la vida. Este número es cuánto YA SE HA GASTADO, y 0 es un neumático nuevo. El MFD del juego muestra el mismo porcentaje, y está medido: con 2 vueltas de 21 el juego daba 10. En el Assetto Corsa este mismo campo es otra cosa: es adherencia, no desgaste.',
    'tyres.notWear': 'no se puede',
    'tyres.notWearWhy': 'El desgaste que publica el juego no acompaña un stint real: da 0,17% tras dos vueltas, o que serían 588 vueltas de vida. No se puede predecir a partir de ahí.',
    'fuel.measuring': 'midiendo',
    'fuel.lapsWhy': 'Vueltas que deberia alcanzar el combustible que queda, al ritmo medio medido. El juego no dice quantos litros se gastan por vuelta, asi que se mide la diferencia entre el principio y el final de cada vuelta.',
    'fuel.oneLapWhy': 'Media de una sola vuelta. Con dos o mas deja de ser una muestra de una y pasa a ser un ritmo.',
    'fuel.avisoWhyPct': 'Igual o por debajo del 15% del depósito. El porcentaje no depende de ninguna medición, al contrario que las vueltas, que solo existen después de una vuelta cerrada.',
    'fuel.avisoWhy': 'Por debajo de 1,5 vueltas: ya' + '\u2019' + ' no da' + '\u2019' + ' para salir de boxes, hacer la vuelta y volver con margen.',
    'fuel.criticoWhy': 'Por debajo de 1 vuelta: no queda margen ninguno. Al ritmo medio, lo que queda se acaba antes de terminar la vuelta.',
    'tyres.lifeNote': 'Estimación a partir del desgaste que ya ha ocurrido en este stint, no de una tabla del juego: Assetto Corsa no publica la vida del compuesto. Tras dos vueltas medidas el número ya significa algo; antes es una suposición.',
    'brakes.title': 'FRENOS', 'brakes.bias': 'B. FRENO',
    'brakes.biasTitle': 'Distribución de la frenada, en porcentaje del freno total. Medido 0,58 en un TS040 sin tocar nada. El HUD de Content Manager muestra el mismo campo y lo ajusta de 0,5 en 0,5.',
    'tyres.damage': 'DAÑOS',
    'tyres.suspDamage': 'SUSPENSIÓN', 'tyres.engineDamage': 'MOTOR',
    'fuel.title': 'COMBUSTIBLE',
    'wx.air': 'AIRE', 'wx.road': 'PISTA', 'wx.wind': 'VIENTO', 'wx.density': 'DENSIDAD', 'wx.grip': 'ADHERENCIA', 'unit.c': '°C',
    "wx.rain": "LLUVIA",
    "wx.seco": "SECO", "wx.chiada": "LLOVIZNA", "wx.chiadaForte": "LLOVIZNA FUERTE", "wx.chuvaFraca": "LLUVIA LIGERA", "wx.chuva": "LLUVIA", "wx.chuvaForte": "LLUVIA FUERTE", "wx.neve": "NIEVE", "wx.trovoada": "TORMENTA", "wx.trovoadaForte": "TORMENTA FUERTE", "wx.furacao": "HURACÁN", "wx.rotuloTempo": "Tiempo", "wx.ventoso": "VENTOSO", "wx.aguaceiro": "AGUACERO", "wx.tornado": "TORNADO", "wx.topoDoCartao": "el tope de lo que tiene el juego",
    "wx.rainTitle": "Intensidad de la lluvia, por la API del juego. Viene de ac.ext_rainParams() y solo existe con el Custom Shaders Patch.",
    "wx.rainUnknown": "La app no puede leer el clima. La intensidad de la lluvia viene del Custom Shaders Patch, que tiene que exponer ac.ext_rainParams() a Python. Sin eso el numero seria 0, y 0 significa 'no llueve', que no es verdad.",
    'fuel.inTank': 'En el depósito', 'fuel.lapsLeft': 'Vueltas',
    'fuel.ambient': 'Aire / pista', 'fuel.penalty': 'Penalización',
    'fuel.ersUsed': 'ERS en la vuelta', 'fuel.none': 'ninguna',
    "lb.posTitle": "Posici\u00f3n oficial del Assetto Corsa. La lista muestra la posici\u00f3n en vivo, que cuenta las vueltas por cerrar; la oficial solo cuenta vueltas completas y por eso va atrasada al principio de una carrera.",
    'lb.title': 'CLASIFICACIÓN', 'lb.telTitle': 'TU COCHE',
    'lb.pos': 'P', 'lb.name': 'PILOTO', 'lb.lap': 'VUELTA',
    'lb.time': 'TIEMPO', 'lb.best': 'MEJOR', 'lb.gap': 'INT.',
    'lb.intTitle': 'Tiempo hasta el coche de delante. En la misma vuelta es el tiempo exacto que tardó en pasar por el mismo punto de la pista; si no, es una estimación según el ritmo de su última vuelta.',
    'lb.penalty': 'Penalización', 'lb.drs': 'DRS',
    'foot.src.ac': 'memoria compartida, sin SimHub',
    'foot.src.f125': 'UDP, sin SimHub',
    'status.live': 'EN VIVO', 'status.paused': 'EN PAUSA',
    'status.closed': 'JUEGO CERRADO', 'status.stale': 'últimos valores',
    'sector': 'SECTOR', 'lapCount': 'VUELTA',
    'drs.off': 'OFF', 'drs.avail': 'LIBRE', 'drs.open': 'ABIERTO',
    'opp.errTitle': 'La app está corriendo, pero una lectura está fallando.',
    'opp.err': 'No es que la app esté apagada — así que no la apagues. La lectura de arriba es lo que está fallando dentro del juego; el log del AC tiene más.',
    'opp.waiting': 'Esperando los datos de los rivales.',
    'opp.how': 'La app <b>AssettoCorsaTelemetry</b> escribe la página de memoria con los coches, y es la nuestra — viene en la carpeta <b>python_app</b> del proyecto. Copiala en <b>assettocorsa/apps/python/actelemetry_strefiz/</b> y activala en Content Manager (<b>Settings → Python Apps → AssettoCorsaTelemetry</b>). Comprueba que arranco en el log del AC, y que el AC esta en una sesion con otros coches.',
    'opp.none': 'Ningún coche en la sesión.', 'lb.pit': 'PIT',
    'jog.title':
      'Juego',
    'jog.sub':
      'Puedes cambiar cuando quieras, aquí o en los ajustes.',
    'jog.why':
      'El juego decide lo que el panel puede mostrar.',
    'jog.abrir':
      'Cambiar de juego',
    'jog.semJogos':
      'El servidor no respondió con la lista de juegos. Reinícialo y abre esta página otra vez.',
    'jog.precisaInstalar':
      'Necesita la app instalada en el juego',
    'jog.divergencia':
      'O navegador ficou com <b>{outro}</b> da última vez, mas o servidor arrancou para <b>{jogo}</b>. Escolhe qual queres.',
    'jog.escolher':
      'Escolher o jogo',
    'abs.off':
      'desconectado',
    'drs.on':
      'conectado',
    'drs.disp':
      'disponible',
    'f1.embraiagemDica':
      'El F1 25 manda el embrague de 0 a 100, con 100 embragado. El panel muestra lo contrario.',
    'f1.volanteDica':
      'El F1 25 manda el volante normalizado, de −1 a 1.',
    'f1.absDica':
      'El F1 25 solo dice conectado o desconectado. No hay porcentaje.',
    'f1.tcDica':
      'En el F1 25 el control de tracción es un modo.',
    'f1.tcMedio':
      'medio',
    'f1.tcCheio':
      'completo',
    'f1.drsDica':
      'El F1 25 dice cuántos metros faltan para la zona DRS.',
    'f1.vidaSemDados':
      'El paquete de neumáticos aún no ha llegado.',
    'f1.vidaDica':
      'Vueltas que faltan, leídas del juego.',
    'f1.combustivelDica':
      'El F1 25 manda el combustible en kilogramos. El Assetto Corsa lo manda en litros.',
    'ac.embraiagemDica':
      'El Assetto Corsa manda el embrague de 0 a 1, y 1,0 es EMBRAGADO. El panel muestra lo contrario.',
    'ac.volanteDica':
      'El ángulo de la rueda, en radianes. El límite no está escrito en ningún sitio.',
    'ac.absDica':
      'El nivel en el que trabaja el ABS, medido en 0,13.',
    'ac.tcDica':
      'El nivel en el que trabaja el control de tracción.',
    'ac.drsDica':
      'El Assetto Corsa no dice dónde está la zona de DRS. El panel mide el flag durante una vuelta entera.',
    'ac.combustivelDica':
      'El Assetto Corsa manda el combustible en litros.',
  },
  'en': {
    'app.title': 'Telemetry', 'boot.waiting': 'Waiting for the game',
    'boot.reading': 'Reading telemetry straight from the game…',

    'menu.title': 'What do you want to see?',
    'menu.sub': 'You can change this later in the settings.',
    'menu.telemetry': 'Telemetry',
    'menu.telemetryDesc': 'Speed, rpm, pedals, tyres, fuel',
    'menu.leaderboard': 'Leaderboard',
    'menu.leaderboardDesc': 'Standings for every car',
    'menu.both': 'Both', 'menu.bothDesc': 'Telemetry and leaderboard at once',
    'set.title': 'Settings', 'set.mode': 'View', 'set.units': 'Units',
    'set.close': 'Close', 'set.menu': 'Menu', 'set.open': 'Settings',
    'set.lang': 'Language', 'set.map': 'Map', 'set.mapOn': 'Show',
    'set.mapOff': 'Hide', 'set.clearMap': 'Clear the drawn map',
    'set.mapViewFull': 'Full track', 'set.mapViewRel': 'Relative view',
    'set.mapViewWhy': 'In the relative view the map is centred on the car and the zoom follows the speed: stopped, it opens up; accelerating, it closes in. That is what you want while driving.',
    'set.acPathWhy': 'For the map to appear complete from the start (instead of being discovered while driving), point this at your Assetto Corsa install folder.',
    'set.acPathSave': 'Save', 'set.mapFlipX': 'Flip X', 'set.mapFlipZ': 'Flip Z',
    'set.acPathAuto': 'Auto-detected: {p}', 'set.acPathOk': 'Valid folder: {p}',
    'set.acPathBad': 'Could not find "content/tracks" in that folder — check the path.',
    'set.acPathNone': 'Not set yet. Without it, the map is drawn while driving.',
    'set.acPathSaving': 'Checking...',
    'set.drsZone': 'DRS zone', 'set.drsMark': 'Mark the zone', 'set.drsMarking': 'Marking... click to stop', 'set.drsClear': 'Clear the DRS zone',
    'set.drsZoneWhy': 'The game does not say where the zone ends: drsAvailable stays at 1 almost everywhere, so the map would be green all the way round. Mark it while driving, on the real line.',
    'set.drsVerdictZona': 'drsAvailable does mark the zone on this track - painted automatically.',
    'set.drsVerdictSempre': 'drsAvailable stayed on almost all the way round, so it does NOT mark the zone. Mark it by hand.',
    'set.drsVerdictNunca': 'drsAvailable never came on on this track, so it does NOT mark the zone.',
    'set.drsAMedir': 'Measuring drsAvailable over a full lap...',
    'set.fps': 'Data rate', 'set.about': 'About',
    'set.aboutBody': 'Telemetry read straight from Assetto Corsa memory, and our own Python app for the opponents.',
    'drs.short': 'DRS', 'gear.label': 'GEAR', 'unit.kmh': 'km/h', 'unit.ms': 'm/s',
    'unit.mph': 'mph', 'unit.rpm': 'rpm', 'ers.short': 'ERS', 'pit.short': 'PIT',
    'state.lim': 'LIM',
    'map.title': 'TRACK MAP', 'pedals.title': 'PEDALS',
    'map.vazio': 'No map yet. Drive a lap and it draws itself.',
    'wheel.title': 'STEERING', 'wheel.note': 'Steering angle, from -1 to 1. The range of the value is'
    + ' not confirmed yet, measured while driving.',
    'map.drsKey': 'DRS zone',
    'pedals.throttle': 'THROTTLE', 'pedals.brake': 'BRAKE',
    'pedals.clutch': 'CLUTCH', 'pedals.handbrake': 'HANDBRAKE',
    'pedals.pequeno': 'not enough room', 'pedals.agora': 'now',
    'laps.title': 'LAPS', 'laps.current': 'CURRENT', 'laps.best': 'BEST',
    'laps.last': 'LAST', 'laps.delta': 'DELTA',
    'tyres.title': 'TYRES AND BRAKES',
    'tyres.life': 'Tyre life',
    'fuel.measuring': 'measuring',
    'fuel.lapsWhy': 'Laps the remaining fuel should reach, at the measured average rate. The game does not say how many litres a lap uses, so it is measured from the difference between the start and the end of each lap.',
    'fuel.avisoWhyPct': '15% of the tank or less. The percentage depends on no measurement at all, unlike laps, which only exist after a lap has been closed.',
    'fuel.oneLapWhy': 'Average of a single lap. With two or more it stops being a sample of one and becomes a rate.',
    'fuel.avisoWhy': 'Below 1.5 laps: not enough to leave the pits, do the lap and come back with margin.',
    'fuel.criticoWhy': 'Below 1 lap: no margin at all. At the average rate, what is left runs out before the lap ends.',
    'tyres.measuring': 'measuring', 'tyres.perLap': 'per lap', 'tyres.needTwoLaps': 'Needs 2 laps before it can estimate', 'tyres.lapsOnThisSet': 'laps on this set',
    'tyres.surface': 'Tread temperature. The big number is the core, which is what the game shows.',
    'tyres.gripWhat': 'Tyre grip, 0 to 100, where 100 is the maximum. Not wear: the field is called `tyreWear` but it measures grip, which is why it drops only 0.45 per lap — grip changes slowly. The wear the Content Manager HUD shows is a different quantity, and the two do not convert.', 'tyres.pressTitle': 'Real pressure, in psi. The game shows the deviation from a nominal that is not published.',
  'tyres.gastoWhat': 'Tyre wear, 0 to 100, where 100 is the end of its life. This number is how much HAS BEEN USED, and 0 is a new tyre. The game MFD shows the same percentage, and it is measured: with 2 laps of 21 the game read 10. In Assetto Corsa this same field is a different thing — it is grip, not wear.',
    'tyres.notWear': 'cannot tell',
    'tyres.notWearWhy': 'The wear the game publishes does not track a real stint: 0.17% after two laps, which would be 588 laps of life. There is no way to predict from it.',
    'tyres.lifeNote': 'Estimated from the wear that has already happened on this stint, not from a game table: Assetto Corsa does not publish the compound life. After two measured laps the number means something; before that it is a guess.',
    'brakes.title': 'BRAKES', 'brakes.bias': 'B. BIAS',
    'brakes.biasTitle': 'Brake distribution, as a percentage of total braking. Measured 0.58 on a TS040 untouched. The Content Manager HUD shows the same field and adjusts it in 0.5 steps.',
    'tyres.damage': 'DAMAGE',
    'tyres.suspDamage': 'SUSPENSION', 'tyres.engineDamage': 'ENGINE',
    'fuel.title': 'FUEL',
    'wx.air': 'AIR', 'wx.road': 'TRACK', 'wx.wind': 'WIND', 'wx.density': 'DENSITY', 'wx.grip': 'GRIP', 'unit.c': '°C',
    "wx.rain": "RAIN",
    "wx.seco": "CLEAR", "wx.chiada": "DRIZZLE", "wx.chiadaForte": "HEAVY DRIZZLE", "wx.chuvaFraca": "LIGHT RAIN", "wx.chuva": "RAIN", "wx.chuvaForte": "HEAVY RAIN", "wx.neve": "SNOW", "wx.trovoada": "THUNDERSTORM", "wx.trovoadaForte": "HEAVY THUNDERSTORM", "wx.furacao": "HURRICANE", "wx.rotuloTempo": "Weather", "wx.ventoso": "WINDY", "wx.aguaceiro": "SQUALL", "wx.tornado": "TORNADO", "wx.topoDoCartao": "the top of what the game has",
    "wx.rainTitle": "Rain intensity, from the game API. It comes from ac.ext_rainParams() and only exists with the Custom Shaders Patch.",
    "wx.rainUnknown": "The app cannot read the weather. Rain intensity comes from the Custom Shaders Patch, which has to expose ac.ext_rainParams() to Python. Without it the number would be 0, and 0 means 'no rain', which is not true.",
    'fuel.inTank': 'In tank', 'fuel.lapsLeft': 'Laps',
    'fuel.ambient': 'Air / track', 'fuel.penalty': 'Penalty',
    "lb.posTitle": "Official Assetto Corsa position. The list shows the live position, which counts laps not yet completed; the official one only counts finished laps, which is why it lags at the start of a race.",
    'fuel.ersUsed': 'ERS this lap', 'fuel.none': 'none',
    'lb.title': 'STANDINGS', 'lb.telTitle': 'YOUR CAR',
    'lb.pos': 'P', 'lb.name': 'DRIVER', 'lb.lap': 'LAP',
    'lb.time': 'TIME', 'lb.best': 'BEST', 'lb.gap': 'INT.',
    'lb.intTitle': 'Time to the car ahead. On the same lap it is the exact time it took him to pass the same point on track; otherwise it is an estimate from the pace of his last lap.',
    'lb.penalty': 'Penalty', 'lb.drs': 'DRS',
    'foot.src.ac': 'shared memory, no SimHub',
    'foot.src.f125': 'UDP, no SimHub',
    'status.live': 'LIVE', 'status.paused': 'PAUSED',
    'status.closed': 'GAME CLOSED', 'status.stale': 'last values',
    'sector': 'SECTOR', 'lapCount': 'LAP',
    'opp.errTitle': 'The app is running, but a read is failing.',
    'opp.err': 'This is not the app being disabled, so do not disable it. The read above is what is failing inside the game; the AC log has more.',
    'drs.off': 'OFF', 'drs.avail': 'READY', 'drs.open': 'OPEN',
    'opp.waiting': 'Waiting for opponent data.',
    'opp.how': 'The <b>AssettoCorsaTelemetry</b> app writes the memory page with the cars, and it is ours — it ships in the <b>python_app</b> folder of the project. Copy it to <b>assettocorsa/apps/python/actelemetry_strefiz/</b> and enable it in Content Manager (<b>Settings → Python Apps → AssettoCorsaTelemetry</b>). Check it started in the AC log, and that AC is in a session with other cars.',
    'opp.none': 'No cars in the session.', 'lb.pit': 'PIT',
    'jog.title':
      'Game',
    'jog.sub':
      'You can change it any time, here or in the settings.',
    'jog.why':
      'The game decides what the dashboard can show.',
    'jog.abrir':
      'Change game',
    'jog.semJogos':
      'The server did not return the list of games. Restart it and open this page again.',
    'jog.precisaInstalar':
      'Needs the app installed in the game',
    'jog.divergencia':
      'The browser still had <b>{outro}</b> from last time, but the server was started for <b>{jogo}</b>. Pick the one you want.',
    'jog.escolher':
      'Choose the game',
    'abs.off':
      'off',
    'drs.on':
      'on',
    'drs.disp':
      'available',
    'f1.embraiagemDica':
      'F1 25 sends the clutch from 0 to 100, with 100 fully engaged. The panel shows the opposite.',
    'f1.volanteDica':
      'F1 25 sends the steering normalised, from −1 to 1.',
    'f1.absDica':
      'F1 25 only says on or off. There is no percentage, and showing one would be inventing a number the game does not give.',
    'f1.tcDica':
      'In F1 25 traction control is a mode: off, medium or full. It is not a 0 to 100 level.',
    'f1.tcMedio':
      'medium',
    'f1.tcCheio':
      'full',
    'f1.drsDica':
      'F1 25 says how many metres are left to the DRS zone.',
    'f1.vidaSemDados':
      'The tyre packet has not arrived yet.',
    'f1.vidaDica':
      'Laps remaining, read from the game.',
    'f1.combustivelDica':
      'F1 25 sends the fuel in kilograms. Assetto Corsa sends litres.',
    'ac.embraiagemDica':
      'Assetto Corsa sends the clutch from 0 to 1, and 1.0 is ENGAGED. The panel shows the opposite.',
    'ac.volanteDica':
      'The steering angle, in radians. The limit is not written anywhere.',
    'ac.absDica':
      'The level the ABS is working at, measured at 0.13.',
    'ac.tcDica':
      'The level traction control is working at.',
    'ac.drsDica':
      'Assetto Corsa does not say where the DRS zone is. The panel measures the flag over a whole lap.',
    'ac.combustivelDica':
      'Assetto Corsa sends the fuel in litres.',
  },
};

let LANG = 'pt-PT';
/* Uma traducao que falta nao pode mostrar a CHAVE no ecra. Durante um
 * exame injectei um NaN e, ao mesmo tempo, olhei para o pt-BR: t()
 * devolvia a propria chave, e um brasileiro lia "tyres.notWear" no sitio
 * do texto. O t() antigo nao tinha fallback nenhum -- (I18N[LANG] &&
 * I18N[LANG][k]) || k -- e por isso uma traducao em falta, ou uma letra
 * trocada no nome da chave, dava texto de programador no interface.
 *
 * Agora: tenta a lingua, cai para o portugues, e se tambem nao houver
 * devolve a propria chave em vez de uma string vazia. E avisa uma vez na
 * consola, para se apanhar a developing e nao em producao. */
let _chavesAvisadas = new Set();
function t(k) {
  const x = I18N[LANG] && I18N[LANG][k];
  if (x) return x;
  const pt = I18N['pt-PT'] && I18N['pt-PT'][k];
  if (pt) {
    if (!_chavesAvisadas.has(k)) {
      _chavesAvisadas.add(k);
      if (typeof console !== 'undefined') {
        console.warn('[i18n] "' + k + '" nao existe em ' + LANG + '; a mostrar o portugues.');
      }
    }
    return pt;
  }
  return k;
}

/* ------------------------------------------------------------ definicoes
 *
 * A LISTA e as omissões não estão aqui: estão em `defs.js`, que é puro e
 * corre no node. Este ficheiro só tem o que é do navegador — a chave de
 * armazenamento e o `try` do `JSON.parse`.
 *
 * O que muda, e porquê:
 *
 * Antes era
 *
 *     DEF = Object.assign({}, DEFAULTS, JSON.parse(raw));
 *
 * que aceita o que vier. Medido no browser, com valores inventados no
 * `localStorage`:
 *
 *     temp: 'banana'    -> ficava em Celsius, sem dizer nada
 *     speed: 'knots'    -> ficava em km/h, sem dizer nada
 *     lang: 'fr'        -> caía para português, com aviso (esse está tratado)
 *     chaveInventada:42 -> sobrevivia, e voltava a ser gravada em cada save
 *
 * Um valor inventado também podia ser do TIPO errado: um `fps: "30"`
 * passava como texto, e o `DEF.fps === 60` passava a ser falso, o botão
 * dos 60 fps deixava de ficar aceso e o SSE ia pedir 60 Hz a um
 * servidor que não dava. Três sítios, uma causa, nada a dizer.
 *
 * `Defs.validar` só deixa passar valores declarados, e devolve o valor
 * DECLARADO — o `30` do esquema, não a string que estava guardada.
 * As chaves que não estão no esquema não entram, o que também impede o
 * ficheiro no `localStorage` de crescer sozinho com o que foi removido.
 *
 * O `ac_path` NÃO entra nisto: vive em `ac_settings.json`, no servidor,
 * e é lido por um caminho próprio. Ver o `AGENTS.md`, e a fase que
 * falta. */
const DEF_KEY = 'acdef.v1';
let DEF = Defs.validar({});

function loadDef() {
  let bruto = null;
  try {
    bruto = localStorage.getItem(DEF_KEY);
  } catch (e) { /* sem armazenamento: as omissões servem */ }
  if (!bruto) { DEF = Defs.validar({}); return; }
  try {
    DEF = Defs.validar(JSON.parse(bruto));
  } catch (e) {
    // JSON illegível. Não é a mesma coisa que um valor inválido: aqui
    // não há nada para validar, e o painel precisa de uma omissão legal
    // para não pintar lixo.
    DEF = Defs.validar({});
  }
}

function saveDef() {
  try { localStorage.setItem(DEF_KEY, JSON.stringify(DEF)); } catch (e) { /* ignora */ }
}

/* "Repor predefinições" volta tudo às omissões — menos a VISTA e o
 * IDIOMA, que estão marcados com `manterNoReset` no esquema.
 *
 * O que NÃO é tocado, e é a razão de isto ser uma função e não um
 * `localStorage.clear()`:
 *
 *   `acmap.v3`     o mapa desenhado, por pista. Desenhá-lo é conduzir.
 *   `ac_settings.json`  a pasta do AC, que vive no servidor.
 *
 * Um `localStorage.clear()` apagava o mapa, e o utilizador perdia o
 * traçado de todas as pistas por causa de um botão nas definições. */
function resetDef() {
  DEF = Defs.repor(DEF);
  saveDef();
}

/* ------------------------------------------------------------ unidades */
const toSpeed = (kmh) => DEF.speed === 'mph' ? kmh / 1.609344 : kmh;
const toTemp = (c) => DEF.temp === 'F' ? c * 9 / 5 + 32 : c;
const spUnit = () => DEF.speed === 'mph' ? t('unit.mph') : t('unit.kmh');
const tUnit = () => DEF.temp === 'F' ? '°F' : '°C';

function fmtSpeed(kmh, dec) {
  const v = toSpeed(kmh);
  return DEF.speed === 'mph' ? v.toFixed(1) : v.toFixed(0);
}
function fmtTemp(c) {
  return Math.round(toTemp(c));
}

/* A unidade de temperatura, para escrever DEPOIS do numero.
   Nos Cards que tem um <i data-i18n="unit.c"> ao lado, a unidade e' um
   elemento e' a traducao que a escreve. Nos pneus e nos travoes o valor
 * e' um texto unico, sem elemento ao lado -- e ai a unidade tinha de
   ficar de fora, e o '51' nao dizia se era graus Celsius ou Fahrenheit.
   A unidade e' a do momento: mudar para Fahrenheit muda o numero e a
 * letra, porque o render corre a cada frame. */
function unidadeTemp() {
  return DEF.temp === 'F' ? '°F' : '°C';
}

/* ------------------------------------------------------------ estado */
const S = {
  path: [],            // [x, y, drs, sector]
  minX: 1e9, maxX: -1e9, minY: 1e9, maxY: -1e9,
  lapPct: [], refLap: null, bestMs: null, lastLapPct: 0,
  lastSector: null, sectorTimes: [], bestSectorTimes: [],
  seenEver: false, trackName: '', lastSave: 0, lastTrackConfig: '',
  // velocidade amortecida, so' para o zoom da vista relativa. A
  // instantanea faz a imagem saltar a cada travagem e fica ilegivel.
  velSuave: 0,
  // historico de posicao dos adversarios, para os desenhar interpolados.
  // Ver opponentsSuaves(): o canal vai a 10 Hz e o ecrã a 60.
  oppHist: {},
  // o id do TEU carro na lista de adversarios (ver renderOpponents)
  localCarId: null,
  // estado da medicao da vida do pneu (ver tyres.js). Nao e' reiniciado
  // a mudanca de pista: so' quando o pneu e' que troca, ou a sessao.
  pneuStint: null,
  combustivel: null,
  posLista: null,       // a posicao, lida da lista
  // onde cada carro estava no inicio, para as setas de posicao
  posicoes: novoRastreadorPosicoes(40),
  // traco da volta em curso de cada adversario, para o intervalo exacto
  // da leaderboard (ver intervaloPreciso em tempos.js)
  oppTracos: novoRastreadorTracos(),
  // id e instante (performance.now()) do ultimo carro a bater o melhor
  // tempo da sessao, para o flash na leaderboard (ver renderOpponents)
  novoMelhorId: null, novoMelhorEm: 0, sessaoMelhorAnterior: null,
  frames: 0, fpsAt: performance.now(), fps: 0,
  trace: { t: [], th: [], br: [], cl: [], hb: [] },
  lastSample: 0, traceHz: 0,
  wasLive: false,          // para detectar reinicio/pausa->corrida (novo troco no mapa)
  forceBreak: false,       // proximo ponto do mapa nao liga ao anterior
  marking: false,          // a marcar a zona de DRS a mao
  // Verificacao do drsAvailable como flag de zona. Fica a medir uma volta
  // antes de dizer que serve: um campo que esta ligado quase sempre nao
  // e' um campo de zona, e' decoracao.
  drsAuto: false,          // aceite como flag de zona
  drsVeredito: null,       // 'zona' | 'sempre ligado' | null (a medir)
  drsConta: 0,             // pontos contados na volta a medir
  drsAceso: 0,             // quantos estavam com drsAvailable a 1
  drsPctMin: 0.02,         // abaixo disto, a pista toda a verde e' uma zona
  drsPctMax: 0.60,         // acima disto, o campo esta sempre ligado

  // Mapa real (lido dos ficheiros do jogo em vez de tracado a conduzir)
  realMap: null,           // {img, width, height, scale, offsetX, offsetZ} quando pronto
  realMapTrack: null,      // 'pista||config' a que o realMap pertence, p/ nao pedir 2x
  realMapPending: null,    // 'pista||config' que esta a ser pedido ao servidor
  opponents: null,         // ultimo snapshot de /events/opponents (p/ desenhar no mapa)
};
const TRACE_N = 420;              // ~7 s a 60 Hz
const TRACE_MAXHZ = 60;

function setTxt(id, v) { const e = $(id); if (e && e.textContent !== v) e.textContent = v; }
function setHtml(id, v) { const e = $(id); if (e && e.innerHTML !== v) e.innerHTML = v; }

/* Um numero pode faltar no primeiro payload (antes de chegar dados). Sem
   este guarda, "undefined + 1" da NaN e aparece um "NaN" na faixa. */
function num(v, def) { return (typeof v === 'number' && isFinite(v)) ? v : (def || 0); }

/* "--:--.---" em Titillium Web Black desenha-se como um bloco pesado.
   Quando esta vazio, fica mais leve e apagado. */
function setTime(id, v) {
  const e = $(id);
  if (!e) return;
  const empty = !v || v.indexOf('--') === 0;
  const txt = v || '--:--.---';
  if (e.textContent !== txt) e.textContent = txt;
  e.classList.toggle('empty', empty);
}

/* ------------------------------------------------------------ tempos */
/* A matematica vive em tempos.js, sem estado e sem DOM, para poder ser
   testada sozinha (tests/test_tempos.html). Aqui so fica o estado. */

function computeDelta(pct, nowSec) {
  return deltaParaRef(S.refLap, pct, nowSec);
}

/* Escreve a delta e pinta-a. Perto de zero fica neutra: um "+0.000" a
   vermelho logo no inicio da volta era enganador, e o numero salta 60
   vezes por segundo, portanto uma zona morta evita tambem o cintilar. */
const DELTA_NEUTRA = 0.05;
function pintarDelta(el, dl) {
  if (!el) return;
  if (dl == null) {
    el.textContent = '+0.000';
    el.style.color = '';
    return;
  }
  el.textContent = (dl >= 0 ? '+' : '') + dl.toFixed(3);
  // vermelho aqui quer dizer "mais lento". E' a cor certa, mas o
  // vermelho puro nao chega aos 4,5:1 que o texto exige -- por isso
  // --red-txt, e nao --red, que fica para os cheios.
  el.style.color = Math.abs(dl) < DELTA_NEUTRA ? ''
    : dl < 0 ? 'var(--green)' : 'var(--red-txt)';
}

function onLapComplete(timeSec) {
  const melhor = melhorTempo(S.bestMs, timeSec);
  if (melhor != null) {
    S.bestMs = melhor;
    S.refLap = S.lapPct.slice();
  }
  S.lapPct = [];
  S.sectorTimes = [];
  fecharVoltaDrs();
}

/* ------------------------------------------------------------- veredito DRS
   Decide se o drsAvailable serve para pintar a zona, depois de uma volta
   inteira. Criterio: a percentagem do tracado com o campo ligado tem de
   ser uma minoria clara. Se for quase tudo, o campo esta sempre ligado e
   nao marca zona nenhuma - e pintar com ele e' pior do que nao pintar. */
function fecharVoltaDrs() {
  if (S.drsVeredito) return;            // ja decidido, nao se mexe
  if (S.drsConta < 400) return;         // volta ainda curta demais
  const frac = S.drsAceso / S.drsConta;
  S.drsFrac = frac;
  if (frac >= S.drsPctMax) {
    S.drsVeredito = 'sempre ligado';
    S.drsAuto = false;
  } else if (frac <= S.drsPctMin) {
    S.drsVeredito = 'nunca ligado';
    S.drsAuto = false;
  } else {
    S.drsVeredito = 'zona';
    S.drsAuto = true;
    // Repintar o que ja foi gravado, agora que se sabe que o campo serve.
    // Cada ponto guarda tambem o drsAvailable original (indice 4), para
    // isto ser possivel mais tarde sem voltar a conduzir.
    let n = 0;
    for (const p of S.path) {
      if (p[4] && !p[2]) { p[2] = 1; n++; }
    }
    S.drsRepintados = n;
  }
  S.drsConta = 0;
  S.drsAceso = 0;
  guardarVereditoDrs();
  syncDrsMarkUI();
}

/* ------------------------------------------------------------ mapa */
/* IMPORTANTE: no AC o eixo Y e' a ALTITUDE. O plano da pista e' X-Z.
   Medido em Spa com 19 adversarios: X 997 m, Y 88 m, Z 2012 m - e o
   desnivel de Spa e' de ~100 m, logo Y nao serve para desenhar a pista.
   Mapear X contra Y dava um rabisco achatado sem ser a pista. */
const MAP_KEY = 'acmap.v3';   // v3: um mapa por pista + cortes de teletransporte
const MAP_MAX_TRACKS = 15;   // quantas pistas ficam guardadas ao mesmo tempo

/* Cada ponto e' [x, z, pintado, sector, drsAvailableOriginal].
   O quinto elemento e' o drsAvailable tal como veio do jogo, guardado para
   poder pintar a zona mais tarde, quando uma volta inteira disser que o
   campo serve. Mapas gravados antes disso tem so quatro: e' aceite, mas
   esses pontos nao podem ser repintados. */
// Acima disto (em metros) o ponto novo NAO liga ao anterior: e' um
// teletransporte (reinicio de sessao, carro posto de novo na grelha,
// voltar aos boxes pelo menu) e nao uma curva apertada a serio. Sem
// isto, o mapa ficava com uma reta a atravessar a pista toda sempre
// que se reiniciava a corrida - o "bug" da imagem partida.
const MAP_JUMP_M = 40;

function pushMapPoint(x, y, drs, sector, drsOriginal) {
  if (!isFinite(x) || !isFinite(y)) return;
  if (x === 0 && y === 0) return;
  const p = S.path[S.path.length - 1];
  let brk = 0;
  if (p) {
    const dist = Math.abs(p[0] - x) + Math.abs(p[1] - y);
    if (dist < 0.3) return;                 // parado: nao vale a pena novo ponto
    if (dist > MAP_JUMP_M) brk = 1;         // salto grande -> novo troco
  } else {
    brk = 1;
  }
  if (S.forceBreak) { brk = 1; S.forceBreak = false; }
  S.path.push([x, y, drs ? 1 : 0, sector | 0, drsOriginal ? 1 : 0, brk]);
  if (S.path.length > 24000) S.path.splice(0, 6000);
  if (x < S.minX) S.minX = x; if (x > S.maxX) S.maxX = x;
  if (y < S.minY) S.minY = y; if (y > S.maxY) S.maxY = y;
  if (!S.drsVeredito) { S.drsConta++; if (drsOriginal) S.drsAceso++; }
  saveMap();
}

// Guarda-se um mapa POR PISTA (nao um unico global): trocar de pista e
// voltar a ela nao obriga a redesenhar tudo outra vez.
function loadAllMaps() {
  try {
    const raw = localStorage.getItem(MAP_KEY);
    return raw ? (JSON.parse(raw) || {}) : {};
  } catch (e) { return {}; }
}
function saveMap(force) {
  if (!force && Date.now() - S.lastSave < 5000) return;
  S.lastSave = Date.now();
  if (!S.trackName) return;
  try {
    const all = loadAllMaps();
    const pts = S.path.map(p => [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10, p[2], p[3], p[4] || 0, p[5] || 0]);
    all[S.trackName] = { p: pts, d: S.drsVeredito, da: S.drsAuto ? 1 : 0, ts: Date.now() };
    // nao deixar crescer para sempre: guarda so as ultimas MAP_MAX_TRACKS pistas
    const keys = Object.keys(all);
    if (keys.length > MAP_MAX_TRACKS) {
      keys.sort((a, b) => (all[a].ts || 0) - (all[b].ts || 0));
      delete all[keys[0]];
    }
    localStorage.setItem(MAP_KEY, JSON.stringify(all));
  } catch (e) { /* quota */ }
}
// Carrega o mapa desta pista, se ja tiver sido percorrida antes: aparece
// completo de imediato, em vez de ter de se descobrir outra vez a andar.
function loadMapFor(trackName) {
  if (!trackName) return false;
  const o = loadAllMaps()[trackName];
  if (!o || !Array.isArray(o.p) || o.p.length < 2) return false;
  S.path = o.p;
  S.drsVeredito = o.d || null;
  S.drsAuto = !!o.da;
  S.minX = 1e9; S.maxX = -1e9; S.minY = 1e9; S.maxY = -1e9;
  for (const p of S.path) {
    if (p[0] < S.minX) S.minX = p[0]; if (p[0] > S.maxX) S.maxX = p[0];
    if (p[1] < S.minY) S.minY = p[1]; if (p[1] > S.maxY) S.maxY = p[1];
  }
  return true;
}
function guardarVereditoDrs() { saveMap(true); }

/* ------------------------------------------------------- mapa real (ficheiros do jogo) */
/* Em vez de descobrir a pista a conduzir, tenta buscar o map.png + a
   escala (map.ini) diretamente da instalacao do Assetto Corsa (o server
   e' que sabe onde isso esta, ver /api/settings). Se nao houver caminho
   configurado, ou a pista nao for encontrada, fica-se com o tracado
   feito a conduzir (comportamento antigo) sem qualquer erro visivel. */
function fetchRealMap(track, trackConfig) {
  const key = track + '||' + (trackConfig || '');
  if (S.realMapTrack === key || S.realMapPending === key) return;
  S.realMapPending = key;
  const url = '/api/track-map?track=' + encodeURIComponent(track)
    + '&config=' + encodeURIComponent(trackConfig || '');
  fetch(url).then((r) => r.json()).then((cfg) => {
    if (S.realMapPending !== key) return; // trocou de pista entretanto
    S.realMapPending = null;
    if (!cfg || !cfg.available || cfg.trusted === false) {
      S.realMap = null; S.realMapTrack = key; return;
    }
    const img = new Image();
    img.onload = () => {
      S.realMap = {
        img, width: cfg.width, height: cfg.height,
        // pixels por METRO, que e' 1 / SCALE_FACTOR do map.ini. Medido com
        // um trajecto real de Monza: com 1/1,4 a distancia mediana a linha
        // da pista e' 0 px; sem dividir, e' 132 m -- o carro aparece fora da
        // pista. Ver Regra nº 17, e o engano do WIDTH/HEIGHT estar em
        // pixEIS da imagem e nao em metros.
        pxPerMetre: cfg.pxPerMetre || 1,
        imageWidth: cfg.imageWidth || img.naturalWidth,
        imageHeight: cfg.imageHeight || img.naturalHeight,
        offsetX: cfg.offsetX || 0, offsetZ: cfg.offsetZ || 0,
      };
      S.realMapTrack = key;
    };
    img.onerror = () => { S.realMap = null; S.realMapTrack = key; };
    img.src = cfg.imageUrl;
  }).catch(() => { S.realMapPending = null; S.realMap = null; S.realMapTrack = key; });
}

/* Mundo (x, z) -> pixel da imagem map.png, com as inversoes das definicoes. */
function worldToMapImg(rm, x, z) {
  const k = rm.pxPerMetre || 1;
  let ix = (x + rm.offsetX) * k;
  let iy = (z + rm.offsetZ) * k;
  if (DEF.mapFlipX) ix = rm.imageWidth - ix;
  if (DEF.mapFlipZ) iy = rm.imageHeight - iy;
  return [ix, iy];
}

function resetMap(clearStorage) {
  S.path = []; S.minX = 1e9; S.maxX = -1e9; S.minY = 1e9; S.maxY = -1e9;
  S.lapPct = []; S.refLap = null; S.bestMs = null; S.sectorTimes = [];
  S.drsVeredito = null; S.drsAuto = false; S.drsConta = 0; S.drsAceso = 0;
  S.forceBreak = true;
  // "clearStorage" apaga so o guardado DESTA pista, nunca das outras
  if (clearStorage && S.trackName) {
    try {
      const all = loadAllMaps();
      delete all[S.trackName];
      localStorage.setItem(MAP_KEY, JSON.stringify(all));
    } catch (e) { /* ignora */ }
  }
}

/* Enquadramento do mapa, partilhado pelas DUAS vistas.
 *
 * Regra nº 16: quando há mais do que uma vista para o mesmo plano do
 * mundo, a convenção de eixos e o enquadramento são um só, escritos num
 * sítio só. As duas vistas divergiram uma vez (o traçado invertia o Z e a
 * imagem não) e o resultado foi um mapa espelhado que ninguém notou.
 *
 * O 'espaço' é a mesma unidade nas duas vistas — píxeis da imagem no mapa
 * real, metros no traçado — e quem chama é que decide. Aqui só se decide
 * o enquadramento: a pista toda dentro da caixa, ou centrado no carro com
 * zoom.
 */
/* O enquadramento do mapa, e o UNICO sitio que decide onde cada ponto cai
 * no canvas.
 *
 * Os dois ramos recebem as MESMAS COORDENADAS: as do mundo, cruas. E o que
 * antes nao era verdade, e o que fazia a vista relativa estar errada.
 *
 *   ramo inteiro    px = ox + (x - origX) * sc
 *   ramo relativo   px = w/2 + (x - carroX) * sc
 *
 * O primeiro precisa da origem porque a pista inteira tem de caber; o
 * segundo nao, porque recentra no carro. Antes o caller subtractia a
 * origem de TUDO, e no ramo relativo isso era subtrair duas vezes: o
 * `carroX` ja' ia cru, e a camara ficava centrada longe do carro, num erro
 * da ordem do `minX` -- centenas de metros numa pista larga.
 *
 * `pxPorM` diz quantos pixels vale um metro NESTE espaco:
 *
 *   mapa tracado   o espaco e' o mundo, e vale 1
 *   mapa real      o espaco e' a imagem do jogo, e vale `rm.pxPerMetre`
 *
 * Sem isso, a vista de perto tratava PIXEIS DA IMAGEM como se fossem
 * METROS: com `pxPerMetre` a 1,4, "150 m" eram 150 pixels, que sao 107 m.
 * O zoom de perto estava errado pelo factor da imagem, e a diferenca
 * mudava de pista para pista -- que e' a forma mais cara de um bug,
 * porque numa pista pode parecer certo.
 *
 * Regra no 10, pela terceira vez: a transformacao parte do centro, com a
 * origem DENTRO dela, e nao misturada com quem a chama. E Regra no 16: as
 * duas vistas tem de usar a mesma convencao, e por isso sao as DUAS esta
 * funcao. */
function mapaEnquadramento(w, h, espW, espH, carroX, carroZ, origX, origZ, pxPorM) {
  const pad = 14;
  const inteira = Math.min((w - pad * 2) / espW, (h - pad * 2) / espH);
  const porMetro = pxPorM || 1;

  if (DEF.mapView !== 'relativa' || carroX == null) {
    const ox = (w - espW * inteira) / 2, oy = (h - espH * inteira) / 2;
    const dx = origX || 0, dz = origZ || 0;
    return {
      sc: inteira,
      relativa: false,
      px: (x) => ox + (x - dx) * inteira,
      py: (y) => oy + (y - dz) * inteira
    };
  }

  // Vista relativa: quão longe se ve, em metros, consoante a velocidade.
  // Lento => perto (ampliado), rápido => longe (fechado). A velocidade é
  // amortecida (S.velSuave) porque a instantânea faz a imagem saltar a
  // cada travagem e fica ilegível.
  //
  // O mais perto são 150 m, e não 70. Com 70 m a bola do carro ficava do
  // tamanho da pista e via-se menos de um segundo à frente a 300 km/h —
  // o piloto pediu para não apertar tanto. 150 m é um compromise: dá para
  // ver a próxima curva sem a bola tapar a estrada.
  // E 150 m CONVERTIDOS para pixels deste espaco. Era aqui que o bug
  // estava: 150 e' uma medida, e o que o canvas mede e' o espaco em que as
  // coordenadas vivem.
  const v = clamp(S.velSuave || 0, 0, 320);
  const t = clamp(v / 280, 0, 1);
  const pertoPx = Math.max(1, 150 * porMetro);
  const perto = Math.max(inteira, Math.min((w - pad * 2) / pertoPx, (h - pad * 2) / pertoPx));
  const longe = inteira;
  const sc = perto + (longe - perto) * t;
  return {
    sc,
    px: (x) => w / 2 + (x - carroX) * sc,
    py: (y) => h / 2 + (y - carroZ) * sc,
    relativa: true,
  };
}

/* As bolas dos adversarios, nas DUAS vistas do mapa (Regra nº 16: um
 * desenho, um sítio).
 *
 * COLORES. A pista e' um traço branco de 2 px sobre preto. Uma bola
 * cinzenta (#8C9394, o que estava) punha-se em cima do traço e fundia-se
 * com ele, e o numero escuro dentro ficava ilegível. Agora:
 *
 *   - anel preto por fora, para a bola se destacar do traço branco. E' a
 *     mesma ideia do contorno do texto, e sem ele não ha' separação;
 *   - preenchimento claro (#D6DCDE), bem acima do cinza-médio, para o
 *     numero escuro ter contraste dentro da bola;
 *   - quem esta' na box e' desenhado a vazado, para se ver de relance sem
 *     gastar uma cor diferente. Antes era branco a 35%, que sobre preto
 *     quase nao se via.
 *
 * TAMANHOS. O minimo subiu de 4 para 7 px: com 4 px de raio o numero de
 * duas casas nao cabia dentro, e via-se um borrão. E quando a bola e'
 * mesmo pequena demais para o numero, nao se escreve numero nenhum -- um
 * '1' cortado lê-se pior do que uma bola sem numero.
 */
function desenhaAdversarios(c, q, paraEspaco, pxPorM) {
  // O piso e' maior na vista relativa: e' a vista de quem esta' a
  // conduzir, e e' onde se precisa de apanhar carros depressa. Na pista
  // inteira 7 px chega para distinguir quem e' quem; com o zoom, 9 px
  // dao o mesmo salto de escala que o resto do mapa.
  //
  // (Tentou-se aqui um afastamento automatico dos carros muito
  // proximos -- ficou pior: numa grelha de partida com 20 carros a
  // "resolver" as sobreposicoes todas ao mesmo tempo, formava-se um
  // amontoado tipo cacho de uvas, sem relacao nenhuma com a posicao
  // real na pista. Revertido: desenha-se cada carro na posicao real, e
  // ponto.)
  const minimo = q.relativa ? 9 : 7;
  const r = clamp(3.4 * pxPorM, minimo, 16);
  const suave = opponentsSuaves(performance.now() - OPP_ATRASO_MS);
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  for (const car of suave) {
    if (car.id != null && car.id === S.localCarId) continue;
    const [ex, ey] = paraEspaco(car.x, car.z);
    const x = q.px(ex), y = q.py(ey);
    if (x < -20 || y < -20 || x > 1e5 || y > 1e5) continue;

    if (car.inPit) {
      // vazado: só o anel, para distinguir sem gastar uma cor
      c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2);
      c.lineWidth = 2; c.strokeStyle = 'rgba(0,0,0,.85)'; c.stroke();
      c.lineWidth = 1.2; c.strokeStyle = 'rgba(214,220,222,.75)'; c.stroke();
      continue;
    }

    c.beginPath(); c.arc(x, y, r + 1.6, 0, Math.PI * 2);
    c.fillStyle = 'rgba(0,0,0,.9)'; c.fill();          // anel de separação
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2);
    c.fillStyle = '#D6DCDE'; c.fill();

    if (car.pos) {
      const txt = String(car.pos);
      // só escreve se couber com folga: 2 casas precisam de ~1.3 px por
      // caracter de raio, mais uma margem
      if (r >= 8 && txt.length * r * 0.62 <= r * 2) {
        c.fillStyle = '#0A0E0E';
        c.font = '700 ' + Math.round(r * 1.35) + 'px Titillium, sans-serif';
        c.fillText(txt, x, y + 0.5);
      }
    }
  }
}

function drawMap(canvasId) {
  const cv = $(canvasId);
  if (!cv || DEF.map === 'off') { if (cv) cv.style.visibility = 'hidden'; return; }
  cv.style.visibility = 'visible';
  const dpr = window.devicePixelRatio || 1;
  const w = cv.clientWidth, h = cv.clientHeight;
  if (!w || !h) return;
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
  }
  const c = cv.getContext('2d');
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, w, h);

  const rm = S.realMap;
  if (rm && rm.img && rm.img.complete && rm.width > 0 && rm.height > 0) {
    drawMapReal(c, w, h, rm);
  } else {
    drawMapTraced(c, w, h);
  }
}

/* Mapa lido dos ficheiros do jogo: a imagem e' a propria pista, so' e'
   preciso encaixa-la no canvas e converter (x,z) do carro/adversarios
   para pixels da imagem. Nao ha "descoberta": aparece completa logo
   na primeira vez que se entra na pista. */
function drawMapReal(c, w, h, rm) {
  const iw = rm.imageWidth || rm.width, ih = rm.imageHeight || rm.height;
  // a posicao do carro, para a vista relativa poder centrar-se nela
  const ult = S.path.length ? S.path[S.path.length - 1] : null;
  const [carX, carZ] = ult ? worldToMapImg(rm, ult[0], ult[1]) : [null, null];
  // O espaço do mapa real e' a IMAGEM do jogo, e nao o mundo: por isso a
  // origem e' zero e a escala vem do `map.ini`. Sem o `pxPorM`, a vista de
  // perto tratava pixels da imagem como se fossem metros.
  const q = mapaEnquadramento(w, h, iw, ih, carX, carZ, 0, 0,
    (rm.pxPerMetre || 1));
  const sc = q.sc, px = q.px, py = q.py;

  c.save();
  // na vista relativa a imagem e' muito maior do que a caixa: sem isto
  // o drawImage pintava a imagem toda, nao o que esta dentro da vista
  if (q.relativa) {
    c.beginPath(); c.rect(0, 0, w, h); c.clip();
  }
  c.globalAlpha = 0.92;
  c.drawImage(rm.img, px(0), py(0), iw * sc, ih * sc);
  c.globalAlpha = 1;

  // zona de DRS marcada a mao, sobre a imagem real (mesmos pontos que o
  // tracado manual usa, so' que projectados na imagem em vez do canvas)
  if (S.path.length > 1) {
    c.lineCap = 'round'; c.lineJoin = 'round';
    c.strokeStyle = '#23CF16'; c.lineWidth = 6;
    c.beginPath();
    let drawing = false, hasZone = false;
    for (let i = 0; i < S.path.length; i++) {
      const pt = S.path[i];
      const [ix, iy] = worldToMapImg(rm, pt[0], pt[1]);
      if (pt[2]) {
        hasZone = true;
        if (!drawing || pt[5]) c.moveTo(px(ix), py(iy));
        else c.lineTo(px(ix), py(iy));
        drawing = true;
      } else { drawing = false; }
    }
    c.stroke();
    if (S.marking) {
      c.save();
      c.globalAlpha = 0.35 + 0.35 * Math.abs(Math.sin(performance.now() / 260));
      c.strokeStyle = '#23CF16'; c.lineWidth = 12;
      c.stroke();
      c.restore();
    }
    const key = $('map-drs-key'); if (key) key.classList.toggle('hidden', !hasZone);
    const key2 = $('map-drs-key2'); if (key2) key2.classList.toggle('hidden', !hasZone);
  }

  // adversarios: posicao interpolada (ver opponentsSuaves). O canal vai a
  // 10 Hz e o ecra a 60, por isso desenhar o ultimo valor dava solavancos.
  // O teu carro e' desenhado a amarelo, em cima disto -- e a lista de
  // adversarios inclui-te, por isso tem de ser filtrado (S.localCarId).
  desenhaAdversarios(c, q, (x, z) => worldToMapImg(rm, x, z), sc * (rm.pxPerMetre || 1));
  const pxPorM = sc * (rm.pxPerMetre || 1);

  // o proprio carro, por cima de tudo
  if (ult) {
    const x = px(carX), y = py(carZ);
    const rMeu = clamp(4.0 * pxPorM, 5, 16);
    c.beginPath(); c.arc(x, y, rMeu, 0, Math.PI * 2);
    c.fillStyle = '#FFD700'; c.fill();
    c.lineWidth = clamp(rMeu * 0.3, 1.4, 3); c.strokeStyle = '#fff'; c.stroke();
  }

  c.restore();
}

/* Mapa tracado a conduzir: usado enquanto nao ha mapa real (pista nao
   encontrada nos ficheiros do jogo, ou pasta do AC nao configurada). */
function drawMapTraced(c, w, h) {
  if (S.path.length < 2) {
    /* O QUE DIZER QUANDO O MAPA ESTA VAZIO
     *
     * Dizia o TITULO do mapa -- "MAPA DA PISTA" -- dentro do sitio onde o
     * mapa devia estar. Nao e' mentira, mas nao ajuda: o painel mostrava
     * um campo vazio sem razao, e quem conduz pensava que o mapa nao
     * funcionava.
     *
     * E a razao importa porque **no F1 25 nao ha' mapa para carregar**:
     * `/api/games` diz `temMapaFicheiro: false`. O Assetto Corsa tem
     * `content/tracks/<pista>/map.png` e o F1 25 nao tem nada equivalente.
     * Portanto no F1 25 o mapa so existe DEPOIS de conduzido, tracado a
     * partir das posicoes -- e isso nao e' uma falha, e o que a frase tem
     * de dizer.
     *
     * E a espera e' o jogo em pausa: o `pushMapPoint` esta' gateado por
     * `d.connected && d.live` de proposito, para o mapa nao se encher de
     * ruido nos menus. */
    c.fillStyle = '#555C5D';
    c.font = '600 12px Titillium, sans-serif';
    c.textAlign = 'center';
    c.fillText(t('map.vazio'), w / 2, h / 2);
    return;
  }

  const spanX = Math.max(S.maxX - S.minX, 1), spanZ = Math.max(S.maxY - S.minY, 1);
  // O Y do canvas CRESCE com o Z. Nao se inverte.
  //
  // Invertia-se, e o mapa saia espelhado: o loop grande de Baku ficava em
  // cima-esquerca em vez de baixo-esquerca, e o piloto notava-o a conduzir
  // ("virei a direita e o mapa virou a esquerda"). Confirmado de tres
  // maneiras: a forma desenhada foi comparada com o mapa oficial da
  // pista, com a imagem real do jogo, e com o relato de quem conduz.
  // As tres dizem o mesmo.
  // Ver Regra nº 16 (as duas vistas tem de usar a mesma convencao) e a
  // imagem em tests/forma_Z_normal.png.
  //
  // O enquadramento vem de mapaEnquadramento, o mesmo que o mapa real usa:
  // as duas vistas nao podem divergir outra vez.
  const ult = S.path[S.path.length - 1];
  const q = mapaEnquadramento(w, h, spanX, spanZ, ult ? ult[0] : null,
    ult ? ult[1] : null, S.minX, S.minY, 1);
  const sc = q.sc;
  // As coordenadas CRUAS, porque e' assim que o `mapaEnquadramento` as
  // quer nos dois ramos. Antes era `p[0] - S.minX`, e no ramo relativo isso
  // era subtrair a origem duas vezes -- a camara ficava centrada longe do
  // carro. Regra no 10: a origem e' da transformacao, nao de quem a chama.
  const px = (p) => q.px(p[0]);
  const py = (p) => q.py(p[1]);

  c.save();
  if (q.relativa) { c.beginPath(); c.rect(0, 0, w, h); c.clip(); }

  // pista, em duas passagens: contorno claro por baixo, cor por cima.
  // Desenhada em TROÇOS: sempre que um ponto vem marcado como corte
  // (path[i][5], ver pushMapPoint), comeca-se um troco novo em vez de
  // ligar ao ponto anterior. E' isto que evita a reta a atravessar a
  // pista quando a corrida reinicia ou o carro e' teletransportado.
  c.lineJoin = 'round'; c.lineCap = 'round';
  c.beginPath();
  for (let i = 0; i < S.path.length; i++) {
    const pt = S.path[i];
    if (i === 0 || pt[5]) c.moveTo(px(pt), py(pt));
    else c.lineTo(px(pt), py(pt));
  }
  c.strokeStyle = 'rgba(85,92,93,.85)'; c.lineWidth = 5.5; c.stroke();
  c.strokeStyle = '#151C1D'; c.lineWidth = 3.5; c.stroke();

  // zona de DRS: os trocos que o utilizador marcou a mao
  c.lineCap = 'round'; c.lineJoin = 'round';
  c.strokeStyle = '#23CF16'; c.lineWidth = 7;
  c.beginPath();
  let drawing = false, hasZone = false;
  for (let i = 0; i < S.path.length; i++) {
    const pt = S.path[i];
    if (pt[2]) {
      hasZone = true;
      if (!drawing || pt[5]) c.moveTo(px(pt), py(pt));
      else c.lineTo(px(pt), py(pt));
      drawing = true;
    } else { drawing = false; }
  }
  c.stroke();
  if (S.marking) {
    // a marcar: um halo a pulsing para se ver onde se esta a pintar
    c.save();
    c.globalAlpha = 0.35 + 0.35 * Math.abs(Math.sin(performance.now() / 260));
    c.strokeStyle = '#23CF16'; c.lineWidth = 13;
    c.stroke();
    c.restore();
  }

  // fronteiras de sector (nunca num corte: um teletransporte muda de
  // sector sem ser uma fronteira a serio)
  c.strokeStyle = '#FFD700'; c.lineWidth = 2;
  for (let i = 1; i < S.path.length; i++) {
    if (S.path[i][3] !== S.path[i - 1][3] && !S.path[i][5]) {
      c.beginPath();
      c.arc(px(S.path[i]), py(S.path[i]), 3.5, 0, Math.PI * 2);
      c.stroke();
    }
  }

  // adversarios, tambem com a posicao interpolada. O tracado usava metros
  // a partir de S.minX/minY, por isso a conversao e' outra -- mas o
  // desenho e' o mesmo, e as duas vistas tem de mostrar o mesmo.
  desenhaAdversarios(c, q, (x, z) => [x - S.minX, z - S.minY], sc);

  // carro
  const p = S.path[S.path.length - 1];
  // o raio segue a escala, para o circulo ter sempre o mesmo tamanho
  // fisico: um carro tem ~4 m. Sem isto, o ponto ficava gigante na vista
  // relativa e minusculo na pista inteira.
  const pxPorM = sc;
  c.beginPath(); c.arc(px(p), py(p), clamp(4.0 * pxPorM, 5, 16), 0, Math.PI * 2);
  c.fillStyle = '#FFD700'; c.fill();
  c.lineWidth = clamp(4.0 * pxPorM * 0.3, 1.4, 3); c.strokeStyle = '#fff'; c.stroke();

  // a legenda só aparece quando há zona marcada
  const key = $('map-drs-key');
  if (key) key.classList.toggle('hidden', !hasZone);
  const key2 = $('map-drs-key2');
  if (key2) key2.classList.toggle('hidden', !hasZone);

  c.restore();
}

/* ------------------------------------------------- grafico dos pedais */
function pushTrace(d) {
  const now = performance.now();
  if (now - S.lastSample < 1000 / TRACE_MAXHZ) return;
  S.lastSample = now;
  const tr = S.trace;
  tr.t.push(now);
  tr.th.push(clamp(d.throttle || 0, 0, 100));
  tr.br.push(clamp(d.brake || 0, 0, 100));
  // O AC reporta clutch com 1.0 = totalmente encaixada (conducao normal)
  // e a descer quando se solta. A documentacao diz "1 = totalmente
  // premida", o que e' enganador. Mostra-se o inverso: quanto esta
  // solta, que e' o que interessa - pontas de embraiagem e kicking.
  tr.cl.push(clamp(100 - (d.clutchRaw != null ? d.clutchRaw : 1) * 100, 0, 100));
  tr.hb.push(d.handbrake != null ? d.handbrake : null);
  while (tr.t.length > TRACE_N) { tr.t.shift(); tr.th.shift(); tr.br.shift(); tr.cl.shift(); tr.hb.shift(); }
}

/* ------------------------------------------------------------ pedais
 *
 * Cada sinal tem a SUA faixa. Antes os quatro sinais eram desenhados
 * uns por cima dos outros no mesmo rectangulo, e o resultado era um
 * lenco de linhas que nao se percebia.
 *
 * E o bug mais serio: 0% e 100% eram desenhados exactamente na borda do
 * canvas (y = h e y = 0), pelo que metade da linha ficava cortada
 * fora. Ou seja, os valores extremes - acelerador a fundo, travagem a
 * fundo, embraiagem solta - que sao os que mais importam a conduzir,
 * eram os que se viam menos. Medido antes da correccao: 320 colunas de
 * 1 px de altura, e o vermelho e o azul a desenharem zero colunas,
 * porque estavam fora do recorte.
 *
 * Agora cada faixa tem a zona de 0% a 100% dentro do canvas, com
 * moldura, area preenchida por baixo da curva e o valor actual escrito.
 */

const JANELA_SEG = 6;          // quantos segundos se veem
const FAIXA_TOPO = 13;        // altura da tira do nome e do valor
const EIXO_ALTURA_MAX = 15;   // altura da regua do tempo, quando ha espaco
const PEDIDO_MINIMO = 1.6;    // largura minima da linha
// Tempo sem amostra nenhuma a partir do qual se admite que o sinal
// acabou. 150 ms e' folgado para o jitter do SSE (que vai ate ~66 ms
// medidos) e muito mais curto do que uma pausa do jogo, que sao
// segundos. Serve para o traço nao inventar uma linha recta atravessada
// no ecra quando o jogo esta parado.
const FALTA_REAL = 150;

const FAIXAS = [
  { key: 'th', color: '#23CF16', fill: 'rgba(35,207,22,0.16)', rot: 'pedals.throttle' },
  { key: 'br', color: '#FF0000', fill: 'rgba(255,0,0,0.14)', rot: 'pedals.brake' },
  { key: 'cl', color: '#2B6CFF', fill: 'rgba(43,108,255,0.14)', rot: 'pedals.clutch' },
  { key: 'hb', color: '#FFD700', fill: 'rgba(255,215,0,0.14)', rot: 'pedals.handbrake' },
];

function preparandoCanvas(id) {
  const cv = $(id);
  if (!cv) return null;
  const dpr = window.devicePixelRatio || 1;
  const w = cv.clientWidth, h = cv.clientHeight;
  if (!w || !h) return null;
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
  }
  const c = cv.getContext('2d');
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, w, h);
  return { cv: cv, c: c, w: w, h: h };
}

function drawPedals(canvasId) {
  const g = preparandoCanvas(canvasId);
  if (!g) return;
  const c = g.c, w = g.w, h = g.h;
  const areaHReal = h;

  const tr = S.trace;
  const n = tr.t.length;

  // O travão de mão só ganha faixa se alguma vez tiver havido dado.
  // Senão fica uma faixa sempre vazia, que parece um erro.
  let comDados = false;
  for (const a of [tr.hb]) {
    for (let i = 0; i < a.length; i++) if (a[i] != null) { comDados = true; break; }
    if (comDados) break;
  }
  const faixas = comDados ? FAIXAS : FAIXAS.slice(0, 3);

  // A regua do tempo e' a primeira coisa a sair quando o rectangulo
  // fica baixo: e' a menos indispensavel das tres. Cada faixa precisa
  // de ~34 px para a curva e o nome caberem; abaixo disso nao ha grafico
  // que preste e e' melhor dizer isso.
  const EIXO_ALTURA = areaHReal >= 170 ? EIXO_ALTURA_MAX : 0;
  const areaH = h - EIXO_ALTURA;
  const faixaH = areaH / faixas.length;
  if (faixaH < 30) {
    c.fillStyle = '#3c4344';
    c.font = '700 10px Titillium, sans-serif';
    c.textAlign = 'center';
    c.fillText(t('pedals.pequeno'), w / 2, h / 2);
    return;
  }

  if (n < 2) {
    c.fillStyle = '#3c4344';
    c.font = '700 11px Titillium, sans-serif';
    c.textAlign = 'center';
    c.fillText('—', w / 2, areaH / 2);
    return;
  }

  const agora = tr.t[n - 1];
  const inicio = agora - JANELA_SEG * 1000;
  const colOf = (i) => Math.floor(((tr.t[i] - inicio) / (JANELA_SEG * 1000)) * w);
  const y = (faixaY, v) => faixaY + FAIXA_TOPO + (1 - clamp(v, 0, 100) / 100) * (faixaH - FAIXA_TOPO - 3);
  const baseY = (faixaY) => faixaY + FAIXA_TOPO + (faixaH - FAIXA_TOPO - 3);

  // ---- regua do tempo, em baixo -------------------------------------
  if (EIXO_ALTURA > 0) {
  c.strokeStyle = '#1e2526';
  c.lineWidth = 1;
  c.fillStyle = '#4a5152';
  c.font = '700 8px Titillium, sans-serif';
  c.textAlign = 'center';
  for (let s = 0; s <= JANELA_SEG; s++) {
    const x = Math.round((s / JANELA_SEG) * w) + 0.5;
    c.beginPath(); c.moveTo(x, areaH); c.lineTo(x, areaH + 3); c.stroke();
    if (s % 2 === 0) {
      const txt = s === 0 ? t('pedals.agora') : '-' + s + 's';
      c.fillText(txt, s === 0 ? w - 12 : Math.min(x + 10, w - 12), areaH + 11);
    }
  }
  }

  // Um for, e nao um forEach: o "continue" nao e' legal dentro de um
  // callback, e a leitura fica mais natural assim.
  for (let fi = 0; fi < faixas.length; fi++) {
    const F = faixas[fi];
    const fy = fi * faixaH;
    const arr = tr[F.key];

    c.fillStyle = 'rgba(0,0,0,0.22)';
    c.fillRect(0, fy + 1, w, faixaH - 3);
    c.strokeStyle = '#1a2021';
    c.lineWidth = 1;
    c.strokeRect(0.5, fy + 1.5, w - 1, faixaH - 4);

    // nome a esquerda, valor actual a direita
    c.textAlign = 'left';
    c.fillStyle = '#5b6364';
    c.font = '700 8px Titillium, sans-serif';
    c.fillText(t(F.rot), 5, fy + 10);
    let ultimo = null;
    for (let k = n - 1; k >= 0; k--) if (arr[k] != null) { ultimo = arr[k]; break; }
    c.textAlign = 'right';
    c.fillStyle = ultimo == null ? '#3c4344' : F.color;
    c.font = '900 10px Titillium, sans-serif';
    c.fillText(ultimo == null ? '—' : Math.round(ultimo) + '%', w - 5, fy + 10);

    // marcas de 0, 50 e 100%
    c.strokeStyle = '#1e2526';
    c.lineWidth = 1;
    const meio = [0, 0.5, 1];
    for (let m = 0; m < meio.length; m++) {
      const yy = Math.round(y(fy, meio[m] * 100)) + 0.5;
      c.beginPath(); c.moveTo(0, yy); c.lineTo(w, yy); c.stroke();
    }

    // ---- a curva --------------------------------------------------
    // Uma passagem, com um cursor que so avanca. Para cada pixel fica o
    // VALOR REAL mais recente nessa coluna - nunca uma media, que
    // mostraria valores que nunca aconteceram.
    //
    // Uma coluna sem amostra NAO e' uma falha: a janela de 6 s num
    // rectangulo de ~330 px vale 18 ms por pixel, e o canal SSE entrega
    // a 30-50 Hz, ou seja 20 a 33 ms por amostra. Metade das colunas
    // fica entao sem amostra, e partir a linha ai dava uma linha
    // partida a cada dois pixels - que foi o que se via. Faltar amostra
    // nao e' faltar dado: o valor continua a ser o ultimo conhecido, e
    // e' esse que se desenha.
    //
    // A linha so parte quando passa mesmo tempo sem amostra nenhuma,
    // que e' o jogo em pausa. Antes disso, nao.
    const pontos = [];
    let i = 0, pendente = null, ultimoT = -1e9;
    for (let x = 0; x < w; x++) {
      const tCol = inicio + (x / w) * JANELA_SEG * 1000;
      while (i < n && colOf(i) <= x) {
        if (arr[i] != null) { pendente = arr[i]; ultimoT = tr.t[i]; }
        i++;
      }
      if (pendente == null) continue;             // nada a desenhar ainda
      if (tCol - ultimoT > FALTA_REAL) { pendente = null; continue; }  // falha a serio
      pontos.push(x, y(fy, pendente));
    }
    if (pontos.length < 4) continue;

    // area preenchida por baixo, um troco de cada vez
    const base = baseY(fy);
    let a = 0;
    while (a + 3 < pontos.length) {
      let b = a;
      while (b + 3 < pontos.length && pontos[b + 2] === pontos[b] + 1) b += 2;
      c.beginPath();
      c.moveTo(pontos[a], base);
      for (let k = a; k <= b; k += 2) c.lineTo(pontos[k], pontos[k + 1]);
      c.lineTo(pontos[b], base);
      c.closePath();
      c.fillStyle = F.fill;
      c.fill();
      a = b + 2;
    }

    // a linha, partida nos mesmos sitios
    c.beginPath();
    let anterior = null;
    for (let k = 0; k + 1 < pontos.length; k += 2) {
      if (anterior === null || pontos[k] !== anterior + 1) c.moveTo(pontos[k], pontos[k + 1]);
      else c.lineTo(pontos[k], pontos[k + 1]);
      anterior = pontos[k];
    }
    c.strokeStyle = F.color;
    c.lineWidth = PEDIDO_MINIMO;
    c.lineJoin = 'round';
    c.lineCap = 'round';
    c.stroke();
  }
}

/* ------------------------------------------------------------ volante
 * O campo e' o 'steerAngle' da pagina de fisica. O ALCANCE nao esta
 * confirmado: o jogo esta fechado e o valor esta congelado a 0, e nao
 * se pode assumir que vaia de -1 a 1 (pode ser em radianos). Por isso o
 * factor esta numa constante isolada e o desenho satura - se um dia
 * rodar sempre ao batente, e' esta constante que esta errada, e
 * mede-se o alcance real a conduzir.
 *
 * Para medir: correr tests\capturar.py e ver o min e o max de 'steer'.
 */
const STEER_REF = 1.0;          // NAO CONFIRMADO - ver nota
const STEER_GIRO = Math.PI * 1.5;   // 1.5 radianos de volta, para leitura rápida

function drawVolante(canvasId, steer) {
  const g = preparandoCanvas(canvasId);
  if (!g) return;
  const c = g.c, w = g.w, h = g.h;

  const cx = w / 2, cy = h / 2;
  const R = Math.min(w, h) / 2 - 2;
  if (R < 10) return;

  const v = clamp(num(steer) / STEER_REF, -1, 1);
  const ang = v * STEER_GIRO;
  const corMarca = v < -0.02 ? '#23CF16' : v > 0.02 ? '#F58020' : '#FFD700';

  // ---- o aro: um circulo com o fundo a direito ------------------------
  // Num volante de F1 o fundo e' plano, para se apoiarem as maos.
  //
  // ATENCAO aos angulos do canvas: o angulo 0 e' a DIREITA e os angulos
  // correm para BAIXO (o eixo do Y aponta para baixo), portanto o topo
  // e' 3pi/2, nao -pi/2. A primeira versao desenhava o arco de aFundo a
  // pi-aFundo, que em canvas e' a parte de BAIXO: o aro saia em cima de
  // uma linha recta e nao se lia como um volante. Foi medido - faltava
  // aro do lado esquerdo e sobrava em baixo.
  //
  // TUDO o que fica dentro deste save/restore roda com o volante -- e'
  // suposto, e' o que diz o angulo. O cubo com o numero fica de FORA
  // (mais abaixo), e nao pode entrar aqui: rodava com o aro e a mais de
  // ~60% do curso (qualquer curva fechada, nao so' um caso extremo)
  // aparecia de cabeca para baixo -- "-60" lia-se "09-". Um numero que
  // se ve a conduzir nao pode ficar ilegivel logo quando mais se precisa
  // dele numa curva apertada.
  c.save();
  c.translate(cx, cy);
  c.rotate(ang);

  const CHAO = 0.70;                 // fracao do raio onde o fundo fica
  const aFundo = Math.asin(CHAO);   // onde o circulo encontra a linha de baixo
  const largura = Math.max(3, R * 0.24);

  // o arco, de um lado ao outro por cima (passa por 3pi/2, que e' o topo)
  // gradiente radial em vez de cinzento chapado, para dar volume ao aro
  const gradAro = c.createRadialGradient(0, 0, R - largura, 0, 0, R);
  gradAro.addColorStop(0, '#2e3637');
  gradAro.addColorStop(1, '#181d1e');
  c.strokeStyle = gradAro;
  c.lineWidth = largura;
  c.lineCap = 'butt';
  c.beginPath();
  c.arc(0, 0, R, Math.PI - aFundo, Math.PI * 2 + aFundo, false);
  c.stroke();

  // linha de baixo, a fechar a figura
  c.beginPath();
  c.moveTo(Math.cos(aFundo) * R, R * CHAO);
  c.lineTo(-Math.cos(aFundo) * R, R * CHAO);
  c.stroke();

  // brilho no aro, para dar volume
  c.strokeStyle = 'rgba(255,255,255,0.16)';
  c.lineWidth = Math.max(1, R * 0.055);
  c.beginPath();
  c.arc(0, 0, R - largura * 0.32, Math.PI - aFundo + 0.5, Math.PI * 2 + aFundo - 0.5, false);
  c.stroke();

  // ---- punhos, a esquerda e a direita ---------------------------------
  // Sao as zonas mais largas. Sem isto o desenho le-se como um anel.
  // O centro do punho e' 0 (direita) ou pi (esquerda). Com o sinal
  // invertido, o arco esquerdo saia com inicio maior que o fim e nao
  // desenhava nada - o volante ficava sem um dos punhos.
  for (const centro of [0, Math.PI]) {
    c.strokeStyle = '#14191a';
    c.lineWidth = largura * 1.1;
    c.lineCap = 'round';
    c.beginPath();
    c.arc(0, 0, R, centro - 0.42, centro + 0.42, false);
    c.stroke();
  }

  // ---- dois raios, de baixo para o cubo ------------------------------
  c.strokeStyle = '#262d2e';
  c.lineWidth = Math.max(2, R * 0.14);
  c.lineCap = 'round';
  for (const sinal of [-1, 1]) {
    c.beginPath();
    c.moveTo(sinal * Math.cos(aFundo) * R * 0.94, R * CHAO * 0.94);
    c.lineTo(sinal * R * 0.30, R * 0.30);
    c.stroke();
  }

  // ---- marca do topo: um chevron, nao um rectangulo -------------------
  // E' ela que diz para que lado rodou. Um triangulo le-se mais depressa
  // que um bloco (aponta na direccao), e e' o que os volantes reais tem
  // pintado no topo do aro.
  c.fillStyle = corMarca;
  c.beginPath();
  c.moveTo(0, -R + largura * 1.05);
  c.lineTo(-largura * 0.62, -R + largura * 0.15);
  c.lineTo(largura * 0.62, -R + largura * 0.15);
  c.closePath();
  c.fill();

  c.restore();

  // ---- cubo com ecra, SEM rodar ----------------------------------------
  // Fica fora do save/restore de proposito (ver nota grande acima): o
  // numero tem de se ler sempre direito, seja qual for o angulo do
  // volante. Quem mostra o ANGULO e' o aro a rodar por baixo dele, mais
  // o brilho a volta do cubo, que fica mais forte quanto mais se roda.
  const glow = Math.abs(v);
  if (glow > 0.03) {
    const gradGlow = c.createRadialGradient(cx, cy, R * 0.22, cx, cy, R * 0.5);
    gradGlow.addColorStop(0, corMarca + Math.round(glow * 110).toString(16).padStart(2, '0'));
    gradGlow.addColorStop(1, corMarca + '00');
    c.fillStyle = gradGlow;
    c.beginPath();
    c.arc(cx, cy, R * 0.5, 0, Math.PI * 2);
    c.fill();
  }

  c.fillStyle = '#14191a';
  c.strokeStyle = '#3c4445';
  c.lineWidth = 1.4;
  c.beginPath();
  if (c.roundRect) c.roundRect(cx - R * 0.36, cy - R * 0.21, R * 0.72, R * 0.42, 4);
  else c.rect(cx - R * 0.36, cy - R * 0.21, R * 0.72, R * 0.42);
  c.fill();
  c.stroke();

  // ecra aceso, com o valor
  c.fillStyle = '#0a2b1a';
  c.fillRect(cx - R * 0.30, cy - R * 0.155, R * 0.60, R * 0.23);
  c.fillStyle = corMarca;
  c.font = '900 ' + Math.max(7, Math.round(R * 0.21)) + 'px Titillium, sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText((v >= 0 ? '+' : '-') + Math.abs(v * 100).toFixed(0), cx, cy - R * 0.035);

  // eixo vertical, para se ver o desvio face ao volante
  c.strokeStyle = 'rgba(255,215,0,0.18)';
  c.lineWidth = 1;
  c.setLineDash([2, 3]);
  c.beginPath();
  c.moveTo(cx + 0.5, cy - R);
  c.lineTo(cx + 0.5, cy + R);
  c.stroke();
  c.setLineDash([]);
}

/* ------------------------------------------------------ barra dos pneus */
function drawTyreBar(id, mid) {
  const cv = $(id);
  if (!cv) return;
  const w = cv.width, h = cv.height;
  const c = cv.getContext('2d');
  c.clearRect(0, 0, w, h);
  const lo = 40, hi = 130;
  const f = clamp((mid - lo) / (hi - lo), 0, 1);
  const g = c.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, '#23CF16'); g.addColorStop(.55, '#23CF16');
  g.addColorStop(.78, '#F58020'); g.addColorStop(1, '#FF0000');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  c.fillStyle = '#fff';
  c.fillRect(clamp(f * w - 1.5, 0, w - 3), 0, 3, h);
}
function tempColor(v, unit) {
  // os limites sao em Celsius, seja qual for a unidade mostrada
  const c = DEF.temp === 'F' ? (v - 32) * 5 / 9 : v;
  // --red-txt e nao --red: este devolve uma cor de TEXTO, e o vermelho
  // puro da 4,32:1 sobre o painel, abaixo dos 4,5:1 que o texto exige.
  if (c >= 105) return 'var(--red-txt)';
  if (c >= 95) return 'var(--orange)';
  return '#FFFFFF';
}

/* ------------------------------------------------------------ construir pneus */
const TYRE_TAGS = ['FL', 'FR', 'RL', 'RR'];
function buildTyres(hostId) {
  const host = $(hostId);
  if (!host || host.childElementCount === 4) return;
  host.innerHTML = '';
  for (let i = 0; i < 4; i++) {
    const d = document.createElement('div');
    d.className = 'tyre';
    d.innerHTML =
      '<span class="tyre-name">' + TYRE_TAGS[i] + '</span>' +
      '<span class="tyre-mid">' +
      '<b class="tyre-temp" id="' + hostId + '-t' + i + '">--</b>' +
      '<span class="tyre-worn" id="' + hostId + '-w' + i + '">--</span></span>' +
      '<span class="tyre-bar-wrap">' +
      '<canvas class="tyre-bar" id="' + hostId + '-b' + i + '" width="120" height="7"></canvas>' +
      '<span class="tyre-press">' +
      '<b id="' + hostId + '-s' + i + '">--</b>' +
      '<span id="' + hostId + '-p' + i + '">--</span>' +
      '</span></span>';
    host.appendChild(d);
  }
}
/* A temperatura de cada roda, TIDA AO MODULO DO JOGO.
 *
 * Este desenho nao conhece os nomes dos campos. Nao sabe que o AC manda
 * `tyreCore` e que o F1 25 manda `tyreTempInner`, e nao tem de saber:
 * quem traduz e' o modulo do jogo, na fronteira, e devolve o mesmo par
 * para os dois -- `principal` (o numero grande) e `secundario` (o
 * pequeno).
 *
 * Antes lia `d.tyreCore`, e no F1 25 a carta mostrava
 * `FL -- 15.5 -- 24.6 psi`: o travessao no sitio da temperatura. Os
 * valores CHEGAVAM -- superficie 49 a 61, interior 96 a 101, medido em
 * Abu Dhabi -- e nao aparecia nada, porque o campo que se lia nao existe
 * naquele jogo.
 *
 * Regra no 22: a traducao acontece uma vez, na fronteira, e nunca dentro
 * da logica de desenho. E Regra no 19 pelo avesso: um `--` parece uma
 * medida em falta, e nao um campo que se leu pelo nome errado.
 *
 * Sem modulo carregado -- antes da escolha do jogo, ou se um modulo vier
 * sem `tempPneu` -- devolve nulos, e o desenho escreve o travessao. E a
 * resposta honesta: nao se sabe, escreve-se que nao se sabe. */
function tempDoPneu(d) {
  const m = globalThis.Jogos && globalThis.Jogos.atual();
  if (!m || !m.tempPneu) return { principal: null, secundario: null };
  const t = m.tempPneu(d);
  return t || { principal: null, secundario: null };
}

/* O combustivel, TIDO AO MODULO DO JOGO, pela razao da temperatura: os
 * dois modulos ja' devolvem `{txt, pct, laps, unidade}` com a unidade
 * certa -- `L` no AC e `kg` no F1 25 -- e a pintura nao usava nada
 * disso. Lia `d.fuelL`, que no F1 25 nao existe, e escrevia "0.0 L" com
 * 7,34 quilos no deposito.
 *
 * E o pior resultado possivel: mostrava ZERO LITROS com o tanque cheio, e
 * "0" parece um numero que ninguem questiona. E' pior do que o "0%" do
 * ERS, porque aqui o valor certo -- 7,34 -- ESTAVA NO PAYLOAD.
 *
 * Regra no 24: a unidade nunca se converte para ser mostrada, escreve-se a
 * que o jogo manda. E Regra no 22: quem traduz e' o modulo. */
/* O QUE O NUMERO DO PNEU E': a pergunta que o desenho nao pode fazer,
 * e a mesma que a temperatura. O `app.js` pintava este valor com a
 * etiqueta de "aderencia" nos QUATRO idiomas, e punha a vermelho o
 * que fosse menor que 20.
 *
 * No AC isso esta' certo: `tyreWear` e' aderencia, 100 e' o maximo, e um
 * numero pequeno e' um pneu sem pegadela. No F1 25 e' o contrario --
 * MEDIDO, e `m_tyresWear` e' quanto ja' foi usado. La um 10 e' um pneu
 * NOVO, e aparecia a vermelho a dizer "aderencia baixa".
 *
 * A correccao nao e' inverter a regra no desenho: e' perguntar ao modulo
 * do jogo, que e' quem sabe (Regra no 22). O modulo devolve o VALOR e o
 * SENTIDO, e a pintura decide a cor -- porque a cor e' apresentacao, e
 * a apresentacao e' uma coisa so para os dois jogos (Regra no 30).
 *
 * Sem modulo carregado -- antes da escolha do jogo -- assume-se o que
 * havia, que e' o do AC. Nao ha' dados para pintar nessa altura, por isso
 * a diferenca nao se ve; e se um modulo vier sem este metodo, mostrar
 * zero e' melhor do que nao mostrar nada.
 */
function desgasteDoPneu(d, i) {
  const m = globalThis.Jogos && globalThis.Jogos.atual();
  const v = (d.tyreWear && d.tyreWear[i] != null) ? d.tyreWear[i] : null;
  const semModulo = { valor: v, aoContrario: false, dica: 'tyres.gripWhat' };
  if (!m || !m.desgastePneu) return semModulo;
  return m.desgastePneu(d, i) || semModulo;
}

function combustivelDoJogo(d) {
  const m = globalThis.Jogos && globalThis.Jogos.atual();
  if (!m || !m.combustivel) return null;
  return m.combustivel(d) || null;
}

function renderTyres(hostId, d) {
  for (let i = 0; i < 4; i++) {
    // O numero grande e' o `principal` do modulo do jogo, e o pequeno e' o
    // `secundario`. Este desenho nao conhece os NOME dos campos: nao sabe
    // que o AC manda `tyreCore` e o F1 25 manda `tyreTempInner`, e nao tem
    // de saber. Quem traduz e' o modulo, na fronteira, e devolve o mesmo
    // par para os dois.
    //
    // A escolha de qual e' o grande e' um juizo POR JOGO -- no AC e' o
    // nucleo, no F1 25 e' a carcasse -- e por isso esta' nos dois modulos,
    // com a medida que a sustenta. Um comentario aqui a justificar uma
    // decisao que pertence ao modulo fica do lado errado, e daqui a um ano
    // ninguem sabe se a medida ainda se aplica ao jogo novo. Regra no 22.
    // NUNCA `t`. O `t` deste ficheiro e' a funcao de traducao, e e' usada
    // dezenas de vezes: `const t = ...` aqui escondia-a, e o
    // `t('tyres.surface')` duas linhas abaixo rebentava com
    // "t is not a function" -- o que ABORTA O RENDER INTEIRO a meio, e o
    // painel ficava com o pneu 0 pintada e nada mais. Nem desgaste, nem
    // pressao, nem combustivel, nem setores. Foi lido como "faltam coisas".
    const tPneu = tempDoPneu(d);
    const core = (tPneu.principal && tPneu.principal[i]) || 0;
    setTxt(hostId + '-t' + i, core ? fmtTemp(core) + unidadeTemp() : '--');
    const te = $(hostId + '-t' + i);
    if (te) te.style.color = tempColor(core);
    // o outro numero, ao lado da pressao, em corpo pequeno
    const sup = (tPneu.secundario && tPneu.secundario[i]) || 0;
    setTxt(hostId + '-s' + i, sup ? fmtTemp(sup) + '°' : '--');
    const se = $(hostId + '-s' + i);
    if (se) se.title = t('tyres.surface');

    // O desgaste e' o campo tyreWear, e NAO e' a percentagem que o jogo
    // mostra. Medido no mesmo instante: o jogo dava 91 / 95 / 91 / 93 e
    // o tyreWear dava 99,8 / 99,9 / 99,8 / 99,9. A ordem do jogo segue a
    // temperatura do nucleo (o mais quente a 115 C era o dos 91%), e nao
    // o desgaste -- que apos duas voltas ainda mal mexeu. Portanto o
    // numero do jogo e' outra grandeza (aderencia, ao que tudo indica) e
    // nao ha' forma de o reproduzir a partir do que o AC publica.
    // Aqui escreve-se DESGASTE, que e' o que medimos, e nao se finge que
    // e' o mesmo numero.
    // A ADERENCIA DO PNEU. E' este o campo `tyreWear`, e o nome e'
    // enganador -- nao e' desgaste.
    //
    // O Live Telemetry, no ac_info, e' uma implementacao independente da
    // mesma leitura, e diz o que o campo e':
    //
    //   AC1's `tyreWear` is a grip/health signal, not a monotonic wear
    //   counter: it starts ~0.995 on a fresh tyre, climbs toward 1.0
    //   during warm-up, then drifts back down as the tyre actually
    //   wears.
    //
    // E divide por 100, para ficar em 0..1.
    //
    // Isto explica o que se mediu, e que antes parecia um erro:
    //
    //   volta 0   100.00  100.00  100.00  100.00   aderencia maxima
    //   volta 1    99.58   99.56   99.23   99.18   -0.42 -0.44 -0.76 -0.82
    //   volta 2    99.07   99.03   98.66   98.60   -0.51 -0.54 -0.58 -0.58
    //   volta 3    98.67   98.68   98.33   98.29   -0.40 -0.35 -0.33 -0.31
    //
    // Sao 0,45 por cento por volta. Se isto fosse desgaste, um pneu
    // duraria 220 VOLTAS, e nenhum composto dura 220 voltas. Nao dura:
    // e' que a aderencia muda devagar. E as rodas de tras a descerem
    // mais e' porque perdem aderencia antes, nao porque se gastem mais.
    //
    // E o HUD do Content Manager, que mostra 70 a 73%, mede OUTRA
    // grandeza: o `wheel.tyreWear` da Lua e' o desgaste consumido, 0 a 1
    // com 1 = destruido. Os dois campos chamam-se igual e nao sao a mesma
    // coisa, e nao ha' conversao entre eles.
    //
    // A documentacao oficial do ACC escreve so' "Tyre wear", sem unidade
    // e sem intervalo. A do AC base esta cifrada e nao se consegue ler.
    // Portanto o nome vem da implementacao de outra pessoa e da medicao,
    // e nao da documentacao -- que fica escrito para quem vier depois.
    const dg = desgasteDoPneu(d, i);
    const val = dg.valor;
    setTxt(hostId + '-w' + i, val == null ? '—' : val.toFixed(1));
    const we = $(hostId + '-w' + i);
    if (we) {
      /* A COR SAI DA GRAVIDADE, e nao do numero cru. Gravidade e' quanto
       * falta para o pior: 0 e' impecavel, 1 e' o fim.
       *
       *   aoContrario = false  ->  1 - v / 100    (AC, aderencia)
       *   aoContrario = true   ->      v / 100    (F1 25, desgaste)
       *
       * E o que garante que os limiares NAO mudam para o AC: com
       * `aoContrario: false`, gravidade >= 0,8 equivale a v <= 20 e
       * gravidade >= 0,6 equivale a v <= 40 -- exactamente o que estava
       * escrito a mao. A correccao do F1 25 nao mexe no AC, e e' por
       * isso que isto se escreve como gravidade e nao como uma segunda
       * regra com os numeros ao lado. */
      const grav = val == null ? null
        : dg.aoContrario ? val / 100 : 1 - val / 100;
      const cls = grav == null ? ''
        : grav >= 0.8 ? ' bad' : grav >= 0.6 ? ' warn' : '';
      we.className = 'tyre-worn' + cls;
      // A dica e' DO JOGO: no AC e' aderencia, no F1 25 e' desgaste usado.
      we.title = t(dg.dica) + (val == null ? '' : ' ' + val.toFixed(1));
    }
    drawTyreBar(hostId + '-b' + i, core);
    // psi, e nao kPa. Medido num F1: 28.7 a 32.3. Se fossem kPa seriam
    // 0.29 a 0.32 bar, menos que a pressao atmosferica (1 atm = 101.3
    // kPa) - impossivel. Como psi da 1.98 a 2.23 bar, que e' o que um
    // F1 usa. A unidade nao vem escrita em lado nenhum, por isso fica aqui
    // escrito para nao se perder.
    const pr = (d.tyrePressure && d.tyrePressure[i] != null) ? d.tyrePressure[i] : null;
    setTxt(hostId + '-p' + i, pr == null ? '--' : pr.toFixed(1) + ' psi');
    const pe = $(hostId + '-p' + i);
    if (pe && pr != null) {
      // O jogo mostra a pressao como DESVIO em relacao a uma nominal
      // (+1.4, -1.5, +1.5, +0.2 psi no Mugello). A nominal nao vem escrita
      // em lado nenhum, e nos ficheiros do jogo so' apareceria em
      // data/tyres.ini, que este carro nao tem. Portanto mostra-se o
      // absoluto -- que e' o numero real -- e diz-se isso na dica.
      pe.title = t('tyres.pressTitle');
    }
  }
  if (hostId === 'tyres') {
    renderTyreLife(d);
    renderDanos(d);
  }
}

/* ------------------------------------------------- vida do pneu (medida) */
function renderTyreLife(d) {
  const el = $('tyre-life');
  const note = $('tyre-life-note');
  const box = $('tyre-life-box');
  if (!el) return;
  const porMedir = (msg) => {
    el.textContent = msg;
    el.className = 'stint-val';
    if (note) note.textContent = '';
    if (box) box.classList.remove('warn', 'bad');
  };
  // Mede-se a partir do 'gasto', que vem com 2 casas decimais, e nao do
  // 'restante', que o acshm.py arredonda a 1. Dez vezes mais resolucao:
  // um stint que gasta 0,4% por volta, ao fim de uma volta da 0,0 com
  // uma casa e nunca media nada.
  const usado = (d.tyreWearUsed || []).filter((v) => typeof v === 'number' && isFinite(v));
  if (!d.connected || usado.length === 0) { porMedir('—'); return; }
  const restante = usado.map((u) => 100 - u);

  const r = Pneus.estimarPneus(S.pneuStint, {
    compound: d.compound || '',
    volta: d.lap,
    restantePorPneu: restante
  });
  S.pneuStint = r.estado;
  if (!r.valido) {
    if (r.impossivel) {
      // Ha' desgaste medido, mas o numero nao cabe num stint. Mostrar
      // "~588 voltas" seria pior do que nao mostrar nada: o campo nao
      // esta' a medir a banda de rodagem.
      porMedir(t('tyres.notWear'));
      if (note) note.textContent = t('tyres.notWearWhy');
      return;
    }
    porMedir(t('tyres.measuring'));
    if (note) note.textContent = t('tyres.needTwoLaps');
    return;
  }
  const voltas = Math.floor(r.voltasRestantes);
  // arredondar para baixo nunca promete uma volta a mais do que existe
  el.textContent = '~' + voltas;
  const cls = voltas <= 2 ? 'bad' : voltas <= 5 ? 'warn' : '';
  el.className = 'stint-val' + (cls ? ' ' + cls : '');
  if (box) box.className = 'stint' + (cls ? ' ' + cls : '');
  if (note) {
    note.textContent = r.voltasNoStint + ' ' + t('tyres.lapsOnThisSet')
      + ' · ' + r.porVolta.toFixed(1) + '% ' + t('tyres.perLap');
  }
  el.title = t('tyres.lifeNote');
}

/* ------------------------------------------------------------- combustível
   A linha "Voltas" mostrava um travessão para sempre, porque não havia
   nada por trás dela: o AC dá `fuelL` e `fuelPct` mas NÃO dá litros por
   volta, e `Fuel_LastLapConsumption` não existe na memória partilhada
   (AGENTS.md Regra nº 7).

   Portanto mede-se, como o pneu mede o desgaste. A matemática está em
   static/combustivel.js, pura e testada no node -- é o `d.fuelLaps` que
   se usava e que nunca chegou a existir.

   O aviso: laranja abaixo de 1,5 voltas, vermelho abaixo de 1,0. Com
   prefers-reduced-motion o piscar vira cor fixa, e a distinção entre as
   duas cores continua a fazer o trabalho sem movimento. */
function renderCombustivel(d) {
  const el = $('fuel-laps');
  const cartao = document.querySelector('.c-fuel');
  // A percentagem, normalizada UMA vez. Serve para o calculo do nivel e
  // para a cor, e tem de ser a mesma nos dois: se cada um normalizasse
  // a seu jeito, um dia uma delas recebia 0 e a outra null, e a cor
  // dizia 'acabou o combustivel' no frame em que o alerta calava.
  // A percentagem vem do MODULO, que a calcula a partir da unidade do
  // jogo: `7.34 / 110` no F1 25 e `7.34 / 100` no AC dao numeros
  // diferentes, e so' um deles e' o que o jogo esta' a mostrar.
  const pct = (comb && typeof comb.pct === 'number') ? comb.pct
    : ((typeof d.fuelPct === 'number' && isFinite(d.fuelPct)) ? d.fuelPct : null);
  const r = Combustivel.estimarCombustivel(S.combustivel, {
    // A QUANTIDADE e' a do modulo, na UNIDADE do jogo. Passar `d.fuelL`
    // mandava ZERO ao estimador no F1 25, e a estimativa de voltas ficava
    // sempre a `a medir` sem razao nenhuma. A unidade e' a do jogo porque
    // o estimador mede uma RACAO -- quanto por volta -- e uma razao de
    // quilos por volta e' valida como uma de litros.
    quanto: (comb && comb.txt && comb.txt !== '--') ? Number(comb.txt) : null,
    voltas: d.lap,
    connected: !!d.connected
  }, pct);
  S.combustivel = r.estado;

  if (el) {
    if (r.valido) {
      const v = Math.max(0, r.voltasRestantes);
      el.textContent = (v >= 99 ? '99+' : v.toFixed(1))
        + (r.soUmaVolta ? ' ~' : '');
      el.title = r.soUnaMedida !== false && r.soUmaVolta
        ? t('fuel.oneLapWhy')
        : t('fuel.lapsWhy');
    } else {
      el.textContent = t('fuel.measuring');
      el.title = t('fuel.lapsWhy');
    }
  }
  if (!cartao) return;

  // O AVISO NAO ESTA PRESO AO `valido`.
  //
  // `valido` quer dizer "sei quantas voltas restam", e so' passa a ser
  // verdadeiro depois de uma volta fechada. O aviso e' outra coisa: a
  // percentagem vem do jogo e existe desde a primeira leitura. Com
  // `r.valido && r.aviso` o alerta nao aparecia na PRIMEIRA volta --
  // que e' quando mais se precisa dele, e foi o que se queixou: 7,4% de
  // combustivel a abrir a corrida, sem nada piscado.
  //
  // O que protege contra o alarme falso nao e' a falta de voltas
  // medidas: com 7% de combustivel o combustivel esta' mesmo a 7%. O
  // que protege e' o caso em que nao ha' NENHUM dado, e esse vem
  //verificado no proprio calculo, que devolve nivel 'desconhecido'.
  const nivel = r.aviso ? r.nivel : 'normal';
  cartao.classList.toggle('fuel-aviso', nivel === 'aviso');
  cartao.classList.toggle('fuel-critico', nivel === 'critico');
  if (nivel === 'normal') {
    cartao.classList.remove('fuel-medindo');
  } else {
    cartao.classList.add('fuel-medindo');
  }
  // A COR segue a percentagem, e nao o nivel. Sao coisas diferentes: o
  // nivel decide se PISCAR (e sao dois limiares independentes, o das
  // voltas e o da percentagem), a cor decide o QUANTO se ve. Se a cor
  // fosse a do nivel, um alerta disparado pelas VOLTAS com 60% de
  // combustivel saltava para o vermelho -- e havia 60% para dar.
  //
  // Por isso a cor sai da percentagem, e nao do nivel. E quando o alerta
  // veio das voltas e a percentagem esta' alta, `corDe` da' null e a
  // carta fica com a cor do aviso, que e' a saida honesta: nao ha
  // percentagem para graduar.
  const cor = Combustivel.corDe(pct);
  if (cor) {
    cartao.style.setProperty('--fuel-cor', cor);
  } else {
    cartao.style.removeProperty('--fuel-cor');
  }
  const pctEl = $('fuel-pct');
  if (pctEl) {
    // diz qual dos DOIS limiares disparou. Um alerta que nao diz porque
    // e' um alarme, e um alarme a que se habitua-se deixa de avisar.
    pctEl.title = nivel === 'normal' ? '' : (r.porPct === nivel
      ? t('fuel.avisoWhyPct')
      : t('fuel.' + nivel + 'Why'));
  }
}

/* ------------------------------------------------------ travões por canto */
function renderBrakes(hostId, d) {
  const host = $(hostId);
  if (!host) return;
  if (host.childElementCount !== 4) {
    host.innerHTML = '';
    for (let i = 0; i < 4; i++) {
      const b = document.createElement('b');
      b.id = hostId + '-' + i;
      b.textContent = '--';
      host.appendChild(b);
    }
  }
  for (let i = 0; i < 4; i++) {
    const v = (d.brakeTemp && d.brakeTemp[i]) || 0;
    const e = $(hostId + '-' + i);
    if (!e) continue;
    e.textContent = v ? fmtTemp(v) + unidadeTemp() : '--';
    // a cor e' sempre calculada em Celsius, mude a unidade nao muda a leitura
    e.style.color = !v ? '' : v > 600 ? 'var(--red-txt)' : v > 400 ? 'var(--orange)' : '#fff';
  }
}

/* ------------------------------------------------------- B. Bias (distribuicao)
 *
 * Medido: 0,58 num Toyota TS040 sem nada mexido. E' uma FRACAO 0..1, e o
 * HUD do Content Manager le o campo com o mesmo nome, mostra-o x100 e
 * ajusta-o de 0,5 em 0,5 (Regra nº 18).
 */
function renderBrakeBias(d) {
  const e = $('brake-bias');
  if (!e) return;
  const v = d.brakeBias;
  if (typeof v !== 'number' || !isFinite(v)) { e.textContent = '—'; return; }
  e.textContent = Math.round(v * 100) + '%';
  e.title = t('brakes.biasTitle');
}

/* ------------------------------------------------------------------ danos
 *
 * A memoria partilhada da' CINCO valores em carDamage. O painel de danos
 * do HUD do Content Manager usa QUATRO, e o desenho diz a ordem:
 *
 *   car.damage[0] = para-choques da frente     (o painel drawing-o no topo)
 *   car.damage[1] = para-choques de tras       (desenhado em baixo)
 *   car.damage[2] = lado esquerdo
 *   car.damage[3] = lado direito
 *
 * E divide por 60 para obter 0..1. Logo o campo e' 0..60, e 60 e' o
 * maximo. O quinto valor da struct nao e' usado por ninguem que eu
 * encontrei -- fica semexplicacao e sem ser mostrado.
 *
 * So se mostra quando ha' dano. Um painel de danos vazio e' ruido, e o
 * HUD do jogo tambem so o mostra quando algo parte.
 */
const DANOS_ORDEM = ['F', 'T', 'E', 'D'];
const DANO_MAX = 60;

/* Generico: desenha N barras de dano (0..1 cada) numa linha .kv, e
 * esconde a linha toda quando nenhuma tem dano -- um painel vazio e'
 * ruido. `itens` e' [{label, frac, title?}, ...]. */
function renderBarraDanos(rowId, hostId, itens) {
  const row = $(rowId);
  const host = $(hostId);
  if (!row || !host) return;
  const algum = itens.some((it) => it.frac > 0.01);
  row.classList.toggle('hidden', !algum);
  if (!algum) return;
  if (host.childElementCount !== itens.length) {
    host.innerHTML = '';
    for (const it of itens) {
      const s = document.createElement('span');
      s.className = 'dmg';
      s.innerHTML = '<i class="dmg-t">' + it.label + '</i>'
        + '<i class="dmg-bar"><b></b></i>';
      host.appendChild(s);
    }
  }
  itens.forEach((it, i) => {
    const el = host.children[i];
    const f = clamp(typeof it.frac === 'number' && isFinite(it.frac) ? it.frac : 0, 0, 1);
    const b = el.querySelector('b');
    if (b) b.style.width = (f * 100).toFixed(0) + '%';
    el.className = 'dmg' + (f > 0.6 ? ' bad' : f > 0.2 ? ' warn' : '');
    if (it.title) el.title = it.title; else el.removeAttribute('title');
  });
}

function renderDanos(d) {
  // carroçaria: vem da propria telemetria (0..60 por lado)
  const v = d.carDamage;
  const corpo = Array.isArray(v) ? v.slice(0, 4).map((x) => (typeof x === 'number' ? x / DANO_MAX : 0)) : [];
  const itens = DANOS_ORDEM.map((lbl, i) => ({ label: lbl, frac: corpo[i] || 0 }));

  // suspensao e motor: NAO vem da telemetria propria, vem da pagina do
  // SimHub (Opponents) -- so' existe quando o proprio carro aparece
  // nessa lista (ver S.localCarId, calculado em renderOpponents()).
  // Entram na MESMA fila em vez de terem a sua propria linha: o cartao
  // tem altura fixa, sem scroll, e nao ha' folga para mais duas linhas
  // (foi tentado -- os travoes ficaram empilhados em cima dos pneus).
  // 'S' e' o pior dos 4 cantos da suspensao, com o detalhe dos quatro
  // na dica; 'M' e' o motor.
  const meu = (S.opponents && Array.isArray(S.opponents.cars) && S.localCarId != null)
    ? S.opponents.cars.find((c) => c.id === S.localCarId)
    : null;
  if (meu && Array.isArray(meu.suspDamage) && meu.suspDamage.length === 4) {
    const susp = meu.suspDamage;
    const pior = Math.max(susp[0], susp[1], susp[2], susp[3]);
    const dica = t('tyres.suspDamage') + ': ' + DANOS_ORDEM
      .map((l, i) => l + ' ' + Math.round(clamp(susp[i], 0, 1) * 100) + '%').join('  ');
    itens.push({ label: 'S', frac: pior, title: dica });
  }
  if (meu && typeof meu.engineDamage === 'number') {
    itens.push({ label: 'M', frac: meu.engineDamage, title: t('tyres.engineDamage') });
  }
  renderBarraDanos('damage-row', 'damage-bars', itens);
}

/* ------------------------------------------------------------ linguas */
function applyLang() {
  LANG = DEF.lang;
  document.documentElement.lang = LANG;
  document.querySelectorAll('[data-i18n]').forEach((e) => {
    e.textContent = t(e.getAttribute('data-i18n'));
  });
  // O aria-label tambem e' texto visivel para quem nao ve. Antes ficava
  // fixo em portugues: em ingles, o botao de fechar anunciava "Fechar".
  // Um leitor de ecra em ingles lia a interface toda em portugues.
  document.querySelectorAll('[data-i18n-aria]').forEach((e) => {
    e.setAttribute('aria-label', t(e.getAttribute('data-i18n-aria')));
  });
  document.querySelectorAll('[data-i18n-title]').forEach((e) => {
    e.setAttribute('title', t(e.getAttribute('data-i18n-title')));
  });
  document.title = t('app.title');
  applyUnits();
  // O rodape' do jogo e' a unica linha que descreve COMO se le o jogo, e
  // por isso e' escrita a mao em vez de levar `data-i18n`. Sem esta
  // chamada, mudar de idioma deixava "shared memory, no SimHub" em
  // ingles num painel em portugues -- e a troca de jogo voltava a ter de
  // ficar aEtiqueta errada quando o painel tinha so' o AC.
  if (typeof globalThis.AplicarJogoNaInterface === 'function') {
    globalThis.AplicarJogoNaInterface();
  }
  if (typeof syncDrsMarkUI === 'function') syncDrsMarkUI();
  if (typeof loadAcPathSettings === 'function') loadAcPathSettings();
}

/* A unidade de velocidade depende de DEF.speed, nao do idioma: com o
   interface em portugues pode-se querer milhas. Por isso e' separado. */
function applyUnits() {
  document.querySelectorAll('.u-speed').forEach((e) => { e.textContent = spUnit(); });
}

/* ------------------------------------------------------------ modos */
function applyMode() {
  const mode = DEF.mode || 'telemetry';
  document.querySelectorAll('.view').forEach((v) => {
    v.classList.toggle('hidden', v.getAttribute('data-view') !== mode);
  });
  document.querySelectorAll('#set-mode button').forEach((b) => {
    b.classList.toggle('on', b.getAttribute('data-mode') === mode);
  });
}
function showMenu(first) {
  $('menu').classList.remove('hidden');
  if (first) $('app').classList.add('hidden');
  $('boot').classList.add('hidden');
  // o menu e' modal: a aplicacao de baixo nao entra na tabulacao
  $('app').inert = true;
}
function pickMode(mode) {
  DEF.mode = mode; saveDef(); applyMode();
  $('menu').classList.add('hidden');
  $('app').classList.remove('hidden');
  $('app').inert = false;
  if (!S.seenEver) $('boot').classList.remove('hidden');
  connectTelemetry();
  // o foco volta para dentro da aplicacao, senao fica no botao do menu
  // que acabou de desaparecer
  const alvo = $('btn-menu');
  if (alvo) alvo.focus();
}

/* ------------------------------------------------------------ definicoes UI */
function syncSettingsUI() {
  const set = (id, v) => {
    document.querySelectorAll('#' + id + ' button').forEach((b) => {
      b.classList.toggle('on', b.getAttribute('data-v') === v);
    });
  };
  set('set-temp', DEF.temp);
  set('set-speed', DEF.speed);
  set('set-lang', DEF.lang);
  set('set-map', DEF.map);
  document.querySelectorAll('#set-map-flip button').forEach((b) => {
    const on = b.getAttribute('data-v') === 'flipx' ? !!DEF.mapFlipX : !!DEF.mapFlipZ;
    b.classList.toggle('on', on);
  });
  document.querySelectorAll('#set-map-view button').forEach((b) => {
    b.classList.toggle('on', b.getAttribute('data-v') === (DEF.mapView || 'inteira'));
  });
  document.querySelectorAll('#set-mode button').forEach((b) => {
    b.classList.toggle('on', b.getAttribute('data-mode') === (DEF.mode || 'telemetry'));
  });
}

/* ------------------------------------------------- pasta do AC (definicoes) */
function setAcPathStatus(msg, cls) {
  const el = $('set-ac-path-status');
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('ok', 'bad');
  if (cls) el.classList.add(cls);
}
function applyAcPathInfo(info) {
  const input = $('set-ac-path');
  if (input && document.activeElement !== input) input.value = info.acPath || '';
  if (!info.acPath) {
    setAcPathStatus(t('set.acPathNone'), null);
  } else if (info.acPathValid) {
    const key = info.autodetected ? 'set.acPathAuto' : 'set.acPathOk';
    setAcPathStatus(t(key).replace('{p}', info.acPath), 'ok');
  } else {
    setAcPathStatus(t('set.acPathBad'), 'bad');
  }
}
function loadAcPathSettings() {
  fetch('/api/settings').then((r) => r.json()).then(applyAcPathInfo).catch(() => {});
}
function saveAcPath() {
  const input = $('set-ac-path');
  if (!input) return;
  setAcPathStatus(t('set.acPathSaving'), null);
  fetch('/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ acPath: input.value.trim() }),
  }).then((r) => r.json()).then((info) => {
    applyAcPathInfo(Object.assign({ autodetected: false }, info));
    // caminho novo: esquece o que sabia da pista atual, para tentar outra vez
    S.realMapTrack = null; S.realMap = null;
    if (S.trackName) fetchRealMap(S.trackName, S.lastTrackConfig || '');
  }).catch(() => setAcPathStatus(t('set.acPathBad'), 'bad'));
}

/* ------------------------------------------------- gaveta e menu: teclado
 *
 * Medido antes de mexer: o foco NAO estava preso. Ao 28.o Tab dentro da
 * gaveta aberta o foco saltava para o botao do cabecalho, que esta por
 * baixo do painel. O Escape nao fechava nada. Nao havia uma unica
 * chamada a .focus() no ficheiro, portanto ao fechar a gaveta o foco
 * ficava perdido no sitio onde o painel ja nao esta.
 *
 * `inert` e' o que resolve a fuga pela raiz: uma subarvore inert nao
 * entra na ordem de tabulacao, logo nao ha nada para o foco "saltar"
 * para tras. Nao e' preciso um ciclo de focus-trap feito a mao.
 *
 * O `aria-modal` diz ao leitor de ecra que isto e' um dialogo e que o
 * que esta atras nao interessa -- sem ele, o leitor de ecra continua a
 * ler o interface de baixo enquanto a gaveta esta aberta.
 */
let _gavetaAberta = false;
let _quemAbriu = null;

function abrirGaveta() {
  const gav = $('settings');
  if (!gav || _gavetaAberta) return;
  _quemAbriu = document.activeElement;
  _gavetaAberta = true;
  gav.classList.remove('hidden');
  $('app').inert = true;          // o interface de baixo sai da tabulacao
  // o foco vai para o botao de fechar, que e' o primeiro util da gaveta
  const alvo = $('set-close');
  if (alvo) alvo.focus();
}

function fecharGaveta() {
  const gav = $('settings');
  if (!gav || !_gavetaAberta) return;
  _gavetaAberta = false;
  gav.classList.add('hidden');
  $('app').inert = false;
  // devolve o foco a quem abriu. Sem isto, quem fecha com o rato fica
  // com o foco no sitio onde o painel ja nao esta.
  if (_quemAbriu && document.contains(_quemAbriu)) _quemAbriu.focus();
  _quemAbriu = null;
}

function gavetaAberta() { return _gavetaAberta; }

function bindSettings() {
  $('btn-set').addEventListener('click', () => (gavetaAberta() ? fecharGaveta() : abrirGaveta()));
  $('set-close').addEventListener('click', fecharGaveta);
  $('btn-menu').addEventListener('click', () => showMenu(false));

  // Escape fecha. Uma tecla que toda a gente espera e que nao existia.
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && _gavetaAberta) {
      ev.preventDefault();
      fecharGaveta();
    }
  });

  document.querySelectorAll('#set-mode button').forEach((b) => {
    b.addEventListener('click', () => { DEF.mode = b.getAttribute('data-mode'); saveDef(); applyMode(); });
  });
  document.querySelectorAll('.menu-card').forEach((b) => {
    b.addEventListener('click', () => pickMode(b.getAttribute('data-mode')));
  });
  const seg = (id, key, after) => {
    document.querySelectorAll('#' + id + ' button').forEach((b) => {
      b.addEventListener('click', () => {
        DEF[key] = b.getAttribute('data-v'); saveDef();
        syncSettingsUI();
        if (after) after();
      });
    });
  };
  seg('set-temp', 'temp', applyLang);
  seg('set-speed', 'speed', applyUnits);
  seg('set-lang', 'lang', () => { applyLang(); syncSettingsUI(); });
  seg('set-map', 'map');

  // flips do mapa: cada botao e' um interruptor independente (nao e' um
  // grupo de escolha unica como os outros 'seg'), por isso nao usa o
  // helper seg() acima.
  document.querySelectorAll('#set-map-flip button').forEach((b) => {
    b.addEventListener('click', () => {
      const v = b.getAttribute('data-v');
      if (v === 'flipx') DEF.mapFlipX = !DEF.mapFlipX;
      else DEF.mapFlipZ = !DEF.mapFlipZ;
      saveDef();
      syncSettingsUI();
    });
  });
  // vista do mapa: pista inteira ou relativa (centrada no carro, com zoom
  // que acompanha a velocidade). Escolha unica, como os outros 'seg'.
  document.querySelectorAll('#set-map-view button').forEach((b) => {
    b.addEventListener('click', () => {
      DEF.mapView = b.getAttribute('data-v') || 'inteira';
      saveDef();
      syncSettingsUI();
    });
  });

  $('set-ac-path-save').addEventListener('click', saveAcPath);  $('set-ac-path').addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') saveAcPath();
  });

  $('set-clear').addEventListener('click', () => { resetMap(true); });
  $('set-drs-mark').addEventListener('click', () => { setMarking(!S.marking); });
  $('set-drs-clear').addEventListener('click', () => {
    for (const p of S.path) p[2] = 0;
    S.marking = false;
    syncDrsMarkUI();
    saveMap(true);
  });
}

/* Liga/desliga a marcacao da zona de DRS. O botao fica com aspecto
   diferente enquanto marca, para nao se esquecer ligado. */
function setMarking(on) {
  S.marking = !!on;
  syncDrsMarkUI();
  if (S.marking) saveMap(true);      // grava logo, para nao perder o que ja ha
}
function syncDrsMarkUI() {
  const b = $('set-drs-mark');
  if (b) {
    b.classList.toggle('on', S.marking);
    b.textContent = S.marking ? t('set.drsMarking') : t('set.drsMark');
  }
  // O veredito do drsAvailable tem de ser visivel. Se a interface decide
  // sozinha se o campo serve para pintar a zona, o piloto tem de poder
  // ver o que ela decidiu - e porque.
  const v = $('set-drs-verdict');
  if (v) {
    let txt;
    if (S.drsVeredito === 'zona') {
      txt = t('set.drsVerdictZona') + ' ' + Math.round((S.drsFrac || 0) * 100) + '%';
    } else if (S.drsVeredito === 'sempre ligado') {
      txt = t('set.drsVerdictSempre');
    } else if (S.drsVeredito === 'nunca ligado') {
      txt = t('set.drsVerdictNunca');
    } else {
      const pc = S.drsConta ? Math.round(100 * S.drsAceso / S.drsConta) : 0;
      txt = t('set.drsAMedir') + ' ' + pc + '%';
    }
    if (v.textContent !== txt) v.textContent = txt;
    v.className = 'set-note drs-verdict' + (S.drsVeredito === 'zona' ? ' bom' : '');
  }
}

/* ------------------------------------------------------------ clima e pneu */
/* O AC nao tem campo de chuva nem de estado do tempo em nenhuma das tres
   paginas. Nao se inventa: mostra-se o que o jogo publica, que e' o
   efeito do clima - ar, pista, densidade, vento - e a aderencia, que e'
   o unico sinal de pista molhada. */

/* A luz e a barra do ERS, a partir do modulo.
 *
 * A DECISAO -- percentagem com maximo, joules sem -- esta' em
 * `nucleo/ers.js`, e nao aqui, porque ja' errou uma vez: o `|| 0` escrevia
 * "ERS 0%" com 1 105 744 J guardados. Um numero plausivel e errado nao
 * se denuncia sozinho (Regra no 19), e uma decisao dessas que fique no
 * meio do codigo de pintura nao se testa.
 *
 * Aqui so fica o desenho, e a barra ESCONDE quando nao ha' percentagem:
 * pintar a zero seria afirmar que a bateria esta' a zeros. */
function pintarErs(idLuz, idBarra, d) {
  const e = Ers.estadoErs(d);
  setLight(idLuz, e.texto, e.estado);
  const b = $(idBarra);
  if (!b) return;
  if (e.pct === null) {
    b.style.width = '0%';
    b.classList.add('hidden');
    return;
  }
  b.classList.remove('hidden');
  b.style.width = e.pct + '%';
  b.classList.toggle('low', e.pct <= 20);
}


function pintarClima(d) {
  // escrever nos dois modos, para o clima nao desaparecer ao mudar de vista
  // A cena do tempo TAMBEM no cabecalho. A carta vive dentro da
  // vista mista, e so' se ve depois de trocar de vista -- o
  // contrario do que se quer de um campo que descreve as condicoes.
  // Chama-se `pintarChuva` e nao se escreve a cena a mao, para o
  // cabecalho e a carta nunca poderem discordar. Regra nº 16
  pintarChuva('h-wx', d);
  for (const pfx of ['', 'b-']) {
    setTxt(pfx + 'wx-air', d.airTemp != null ? fmtTemp(d.airTemp) : '—');
    setTxt(pfx + 'wx-road', d.roadTemp != null ? fmtTemp(d.roadTemp) : '—');
    // m/s, a unidade que o jogo publica ("Wind speed in m/s", na
    // documentacao). Com km/h, o valor chegava 3,6 vezes maior e o
    // numero do painel nao correspondia ao que o jogo escrevia.
    //
    // UMA CASA DECIMAL, e nao nenhuma. Em m/s o vento e' um numero
    // pequeno -- tipicamente 0 a 8 -- e arredondar 3,7 a 4 e' um terco
    // de erro. Com km/h a mesma perda passava despercebida, porque
    // 12,5 arredondado a 13 nao se nota.
    setTxt(pfx + 'wx-wind', d.windSpeed != null ? d.windSpeed.toFixed(1) : '—');
    pintarGrip(pfx + 'wx-grip', d.surfaceGrip);
    pintarChuva(pfx + 'wx-rain', d);
  }

  // densidade do ar: 1.225 ao nivel do mar, menos um pouco por altitude
  // e por ar frio. Mostra-se com tres casas porque a diferenca entre dois
  // dias e' na terceira casa.
  const dens = $('wx-density');
  if (dens) {
    dens.textContent = d.airDensity != null ? d.airDensity.toFixed(3) : '—';
    // fora do plausivel (0.9 a 1.4) e' melhor cinzento do que um numero
    // acredivel mas errado
    const ok = d.airDensity != null && d.airDensity > 0.9 && d.airDensity < 1.4;
    dens.style.color = ok ? '' : 'var(--grey)';
  }

/* A CHUVA.
 *
 * Vem da API Python que a nossa app publica -- a memoria partilhada
 * nao a tem, e isso esta' confirmado campo a campo (chuva.md, Regra
 * no 15). A app le ac.ext_rainParams()[0], que e' 0..1.
 *
 * O -1 e' "nao se sabe", e e' o que aparece quando o Custom Shaders
 * Patch nao expoe essa funcao ao Python. Nesse caso mostra-se um
 * travessao com a dica a dizer porquê, e NAO um zero: um zero e' "nao
 * chove", que e' uma afirmacao que nao temos.
 *
 * O que se mostra, em pt-PT:
 *   -1     travessao, e a dica explica que a app nao le o clima
 *    0     a palavra "seco", a cinzento
 *   0..1   a percentagem, com a cor a mudar com a intensidade
 */
/* O TEMPO vai para o `tempo.js`, que e' puro e testa-se no node.
 *
 * A tabela das cenas -- os limiares, a escala e as bandas -- estava aqui
 * dentro, escrita a mao. Saiu para o modulo por duas razoes:
 *
 *  - e' a ESCOLA DO JOGO, e a escala esta' em
 *    `ac_info/apps/lua/PurePlanner/settings/settings_defaults.lua`, com 39
 *    cenas e as quantidades do proprio AC. Uma copia feita a mao e' uma
 *    copia que diverge (Regra nº 16).
 *  - dentro desta IIFE nao se testa. E' por isso que os cortes errados
 *    so' apareceram ao olhar para o ecra, tarde demais. No node
 *    alimentam-se as 39 quantidades e ve-se logo qual cai onde.
 */
function pintarChuva(id, d) {
  const el = $(id);
  if (!el) return;
  const u = $(id + '-u');
  const v = d.rainAmount;

  // "nao sei" NAO e' "seco". O -1 e' a app a dizer que nao consegue ler o
  // tempo, e escrever "seco" seria mentir: a regra nº 19, e a razao de
  // aqui nao haver nada de especial. E' o que se fez desde o principio.
  if (v == null || v < 0) {
    el.textContent = '—';
    el.style.color = 'var(--grey)';
    el.title = t('wx.rainUnknown');
    if (u) { u.textContent = ''; u.style.display = 'none'; }
    return;
  }
  if (u) u.style.display = '';

  // O VENTO entra na cena. A tabela de 37 cenas do Pure Planner tem DUAS
  // com a mesma chuva e ventos opostos -- `tornado` (0,300 de chuva,
  // 100 de vento) e `heavy_sleet` (0,300, 0) -- e com so' a chuva as
  // duas diziam a mesma coisa. O `windSpeed` ja' era lido, ia no
  // cabecalho da pagina, e estava a ser deitado fora.
  //
  // Fica -1 quando nao ha' vento medido, e o `tempo.js` ignora o -1 e
  // comporta-se exactamente como antes. E' o que acontece em qualquer
  // sessao sem o Custom Shaders Patch.
  const w = (d.windSpeed == null || d.windSpeed < 0) ? -1 : d.windSpeed;
  const cena = Tempo.cenaDe(v, w);
  const pct = Tempo.percentDe(v);
  el.textContent = t('wx.' + cena);
  el.title = t('wx.rainTitle') + ' ' + pct + '%'
    + (v >= Tempo.CHUVA_MAXIMA ? '  (' + t('wx.topoDoCartao') + ')' : '')
    // O vento na dica, com o numero cru. E' o unico sitio onde se poe
    // sem interpretar: enquanto a UNIDADE da coluna `wind` da tabela nao
    // estiver confirmada -- o AC documenta m/s, a tabela nao diz nada --
    // o numero e' o que se pode ler sem estar a supor. Ver CENAS_VENTO.
    + (w >= 0 ? '  \u00b7  ' + t('wx.wind') + ' ' + w.toFixed(1) + ' m/s' : '');
  // O numero vai na dica, e nao ao lado da palavra. Com "TROVOADA" ou
  // "TROVOADA FORTE" nao cabia: a margem entre a palavra e a unidade e'
  // de 2 px, e o resultado era "TROVOADA30%", lido como uma palavra so.
  // A PALAVRA e' o sinal, a COR e' a intensidade, e o numero exato e'
  // para quando se passa o rato.
  if (u) u.textContent = '';

  // A cor segue a intensidade. Nao e' decoracao: em chuva forte o valor
  // muda depressa, e e' o que se quer ver a correr.
  // A cor segue a CENA, e nao a chuva. Antes eram dois calculos
  // separados, com limiares proprios -- 0,125 e 0,6 -- e a palavra vinha
  // das bandas, com 0,125, 0,35 e 0,6. Discordavam entre 0,35 e 0,6: a
  // palavra dizia TROVOADA FORTE e a cor era a de chuva a serio.
  // Nenhum teste via isso, porque os dois estavam certos porlado.
  const nivel = Tempo.nivelDe(v, w);
  const cor = nivel === 'muiforte' ? 'var(--blue)'
    : (nivel === 'forte' || nivel === 'moderada') ? 'var(--badge-blue)'
    : '';
  el.style.color = cor;
  if (u) u.style.color = cor;
}
}

/* Aderencia: 1.0 e' o valor de seco. Só se pinta quando desce, que e'
   quando chove. Nao se escreve "molhado" com base numa suposicao - o
   numero fala por si. */
function pintarGrip(id, v) {
  const g = $(id);
  if (!g) return;
  // Negativo e' "nao disponivel", a mesma convencao da posicao: o leitor
  // so' o usa quando o jogo nao esta a simular o carro. Sem isto, o 0
  // chegava aqui e era pintado a VERMELHO -- e um '0.00' a vermelho diz
  // ao piloto que o carro esta' sobre gelo, quando na verdade nao havia
  // nada para saber. Medido: 'ADERENCIA 0.00' a vermelho com o carro no
  // Nordschleife, a tracado, com os pneus a 39-42 graus.
  const saber = v == null || v < 0;
  g.textContent = saber ? '—' : v.toFixed(2);
  g.style.color = saber ? '' : v >= 0.98 ? '' : v >= 0.85 ? 'var(--orange)' : 'var(--red-txt)';
}

/* O nome do pneu vem do jogo em varios formatos. Nos carros de 2025 e'
   "Pirelli P Zero 2025 C3 (C3)" - o codigo esta entre parenteses. No AC
   base pode ser "dry_compound", sem codigo nenhum. Só se mostra o badge
   quando ha codigo: nada de adivinhar uma sigla a partir de um nome. */
function codigoPneu(nome) {
  if (!nome) return '';
  const m = String(nome).match(/\(([^)]{1,12})\)\s*$/);
  return m ? m[1].trim() : '';
}
function pintarPneu(d) {
  const nome = d.compound || '';
  // o modo telemetria e o modo misto tem os seus cartoes, por isso escreve
  // nos dois senao o pneu so aparecia num dos modos
  setTxt('compound-name', nome || '—');
  setTxt('compound-name2', nome || '—');
  const codigo = codigoPneu(nome);
  for (const id of ['compound-code', 'compound-code2']) {
    const badge = $(id);
    if (!badge) continue;
    if (codigo) {
      badge.textContent = codigo;
      badge.hidden = false;
    } else if (nome && nome.indexOf('_') < 0) {
      // sem codigo entre parenteses, mas com um nome limpo: mostra o nome
      badge.textContent = nome.toUpperCase();
      badge.hidden = false;
    } else {
      badge.hidden = true;
    }
  }
}

/* ------------------------------------------------------------ widgets */
function setDrs(els, d) {
  const on = d.drsEnabled >= 1, avail = d.drsAvailable >= 1;
  // classList.toggle em vez de reescrever o className: assim mantem-se
  // qualquer classe de posicionamento (ex. "drs-inline") que o HTML ja
  // tenha, em vez de a apagar a cada frame.
  els.forEach((e) => {
    if (!e) return;
    e.classList.toggle('open', !!(d.hasDRS && on));
    e.classList.toggle('avail', !!(d.hasDRS && !on && avail));
    // A CARTA INTEIRA tambem avisa, e nao so' a caixa do DRS. A caixa e'
    // um rectangulo pequeno dentro de um painel grande cheio de
    // numeros -- e' o que se ve com o canto do olho a acelerar, mas
    // tanto o painel como a caixa competingem pela mesma atencao, e a
    // que ganha e' a do combustivel, que e' maior.
    //
    // A classe vai para o `.card` que contem o DRS, e nao se usa
    // `:has(.drs.avail)` no CSS: o `:has()` e' um seleccionador que,
    // num browser que nao o suporte, nao dá erro nenhum -- a regra
    // simplesmente nunca casa e o alerta nunca aparece. Um alerta que
    // falha em silencio e' pior do que um alerta que nao existe,
    // porque alguem conta com ele. Ver Regra nº 14.
    const cartao = e.closest('.card');
    if (cartao) cartao.classList.toggle('drs-alert', !!(d.hasDRS && !on && avail));
  });
  return { on, avail };
}
function setLight(id, txt, cls) {
  const e = $(id);
  if (!e) return;
  e.querySelector('.l-val').textContent = txt;
  e.className = 'light' + (cls ? ' ' + cls : '');
}

/* ABS e TC: mostra o nivel de ajuste em percentagem, com barra. O valor
   vem do AC como 0..1. Acima de meio caminho a barra fica a salientar,
   porque e' ai que o assist comeca a mexer na travagem de verdade.
   Recebe o ELEMENTO, nao o id - como o setDrs. Passar o id aqui dava
   getElementById(elemento) = null e nao sevia nada, sem erro nenhum. */
function pintarNivel(card, bar, nivel) {
  if (!card) return;
  const v = clamp(num(nivel), 0, 1);
  const pc = Math.round(v * 100);
  const val = card.querySelector('.l-val');
  if (val) val.textContent = pc + '%';
  card.className = 'light' + (v <= 0.001 ? '' : v >= 0.5 ? 'warn' : 'on');
  if (bar) {
    bar.style.width = pc + '%';
    bar.classList.toggle('low', v < 0.25);
  }
}

function renderSectors(d) {
  const host = $('sectors');
  if (!host) return;
  const n = d.sectorCount || 0;
  if (!n) { host.innerHTML = ''; return; }
  if (host.childElementCount !== n) {
    host.innerHTML = '';
    for (let i = 0; i < n; i++) {
      const b = document.createElement('div');
      b.className = 'sector-box';
      b.innerHTML = '<span>S' + (i + 1) + '</span><b>--</b>';
      host.appendChild(b);
    }
  }
  const last = d.lastSectorTime;
  const cur = (d.sector || 0);
  Array.prototype.forEach.call(host.children, (b, i) => {
    b.classList.toggle('cur', i === cur);
    b.classList.toggle('best', S.bestSectorTimes[i] != null &&
      last !== '--:--.---' && last <= S.bestSectorTimes[i]);
    const v = b.querySelector('b');
    if (i < cur && S.sectorTimes[i]) v.textContent = S.sectorTimes[i];
    else v.textContent = i === cur ? '·' : '--';
  });
}

/* ------------------------------------------------------------ telemetria */
let esTel = null, esOpp = null;

function connectTelemetry() {
  if (esTel) esTel.close();
  const url = '/events?fps=' + clamp(DEF.fps || 60, 5, 60);
  esTel = new EventSource(url);
  esTel.onmessage = (ev) => {
    let d; try { d = JSON.parse(ev.data); } catch (e) { return; }
    render(d);
  };
  esTel.onerror = () => {
    if (esTel && esTel.readyState === EventSource.CLOSED) {
      setTimeout(connectTelemetry, 1500);
    }
  };
}
function connectOpponents() {
  if (esOpp) esOpp.close();
  esOpp = new EventSource('/events/opponents?fps=10');
  esOpp.onmessage = (ev) => {
    let d; try { d = JSON.parse(ev.data); } catch (e) { return; }
    renderOpponents(d);
  };
}

let lastD = null;
/* --------------------------------------------------- numeros nao-finitos
 *
 * MEDIDO: injectar NaN ou Infinity nos campos numericos deixa o render()
 * preso. Um render() normal leva 0,5 ms; com um nao-finite nos campos, a
 * chamada nao voltou em 60 segundos -- e o separador ficou inutilizavel,
 * ate a navegacao deixar de responder. Nao e' lento: e' um ciclo que nao
 * acaba.
 *
 * Isto ja tinha acontecido do outro lado, e e' por isso que a defesa se
 * poe aqui: o AC publica INFINITO em varios campos quando a sessao nao
 * tem limite de tempo (o sessionTimeLeft de um treino sem cronometro).
 * O acshm.py ganhou _finito() para nao rebentar o /api/state. O cliente
 * nunca teve a mesma defesa, e o mesmo tipo de valor, no mesmo sitio,
 * com outro sintoma.
 *
 * A defesa e' no limite: um numero que nao e' finito NAO E' UM DADO, e
 * trata-se como um campo que ainda nao chegou. Nao se poe 0, porque 0
 * significa "parado" e seria uma mentira -- o codigo de desenho ja sabe
 * lidar com a ausencia, e e' isso que se quer mostrar. Verificado: com
 * todos os numeros a NaN, o ecra mostra "--", "--:--.---", "a medir" e
 * "—", e nao aparece um unico "NaN", "undefined" ou "Infinity".
 *
 * Nao isolei o campo culpado: a instrumentacao (um limite de 60 s por
 * tentativa) era demasiado grossa. Nao faz falta saber qual e' -- com a
 * sanitizacao a classe do bug deixa de existir.
 */
function sanear(d) {
  if (!d || typeof d !== 'object') return d;
  for (const k in d) {
    const v = d[k];
    if (typeof v === 'number') {
      if (!isFinite(v)) d[k] = undefined;
    } else if (Array.isArray(v)) {
      for (let i = 0; i < v.length; i++) {
        if (typeof v[i] === 'number' && !isFinite(v[i])) v[i] = null;
      }
    }
  }
  return d;
}

function render(d) {
  d = sanear(d);
  S.frames++;
  const now = performance.now();
  if (now - S.fpsAt >= 1000) {
    S.fps = Math.round(S.frames * 1000 / (now - S.fpsAt));
    S.frames = 0; S.fpsAt = now;
    setTxt('fps', S.fps + ' fps');
  }

  const live = d.live;
  if (d.connected) {
    S.seenEver = true;
    if (DEF.mode) { $('boot').classList.add('hidden'); $('app').classList.remove('hidden'); }
  }
  document.body.classList.toggle('paused', !live);
  const sp = d.sincePacket || 0;
  setTxt('status', (live ? t('status.live') : (sp < 90 ? t('status.paused') : t('status.closed')))
    + (live ? '' : '  ·  ' + t('status.stale')));

  // troca de pista: guarda o que tinhamos, limpa o traçado em memoria
  // (sem apagar o que ja esta guardado de OUTRAS pistas) e, se ja
  // tivermos mapeado esta pista antes, carrega-a completa de imediato -
  // e' isto que faz o mapa "estar la" em vez de ser descoberto outra
  // vez sempre que se entra numa pista ja conhecida.
  if (d.track && d.track !== S.trackName) {
    if (S.trackName) saveMap(true);
    S.trackName = d.track;
    S.lastTrackConfig = d.trackConfig || '';
    resetMap(false);
    loadMapFor(d.track);
    S.realMap = null;                 // nao mostrar o mapa da pista anterior
    fetchRealMap(d.track, d.trackConfig || '');
  }

  // cabecalho
  setTxt('track', d.track || '—');
  setTxt('car', d.car || '—');
  setTxt('session', d.session || '—');
  setTxt('compound', (d.compound || '').replace(/_/g, ' '));
  // A posicao vem da LISTA (S.posLista), que e' a mesma que a linha do
  // jogador mostra. O d.position da fisica e' o recurso para quando a
  // lista ainda nao chegou -- nao a fonte normal.
  //
  // Antes eram dois campos diferentes para o mesmo facto: o cabecalho
  // usava a fisica e a lista a pagina dos adversarios. Por isso
  // discordavam, e porque mexer numa ponta nao resolvia a outra.
  const posCabecalho = (S.posLista > 0) ? S.posLista : d.position;
  setTxt('pos', posCabecalho > 0 ? 'P' + posCabecalho : '-');
  setTxt('lap', t('lapCount') + ' ' + (num(d.lap) + 1) +
    (d.totalLaps ? '/' + d.totalLaps : ''));
  const fl = $('flag');
  if (fl) {
    fl.textContent = d.flag || '—';
    fl.className = 'h-flag' + (d.flagId === 2 ? ' f-yellow' : d.flagId === 3 ? ' f-red'
      : d.flagId === 1 ? ' f-blue' : d.flagId === 5 ? ' f-checkered' : '');
  }
  const dr = setDrs([$('drs-light'), $('b-drs-light')], d);

  // central (modo telemetria)
  setTxt('speed', fmtSpeed(d.speed || 0));
  setTxt('gear', d.gear || 'N');
  const maxRpm = d.maxRpm || 12000;
  const pct = clamp((d.rpm || 0) / maxRpm * 100, 0, 100);
  setTxt('rpm', d.rpm || 0);
  $('rpm-fill').style.width = (100 - pct) + '%';
  setTxt('shift-hint', pct > 92 ? '▲' : '');

  // O ERS, por `estadoErs()`: com maximo e' percentagem, sem maximo e' os
  // joules e a barra desaparece. O `|| 0` que estava aqui dava "0%" ao F1
  // 25, que tem bateria e nao diz quanto cabe.
  pintarErs('l-ers', 'ers-bar', d);
  // ABS e TC sao o NIVEL de ajuste, nao "esta a actuar". Medido: em 4502
  // amostras com travagens duras e aceleracao a fundo, os dois ficaram
  // constantes (0.13 e 0.08). Antes isto mostrava "OFF" sempre que o
  // nivel era menor que 0.5, o que faz dizer ao piloto que nao tem
  // nada de ABS quando tem 13%.
  pintarNivel($('l-abs'), $('abs-bar'), d.abs);
  pintarNivel($('l-tc'), $('tc-bar'), d.tc);
  setLight('l-pit', d.pitLimiter ? t('state.lim') : d.isInPit ? t('lb.pit') : '—',
    d.pitLimiter ? 'bad' : d.isInPit ? 'warn' : '');

  // tempos
  setTime('t-current', d.currentTime);
  setTime('t-best', d.bestTime);
  setTime('t-last', d.lastTime);
  const curSec = toSec(d.currentTime);
  if (curSec != null) {
    const p = d.trackPct || 0;
    if (p < S.lastLapPct - 0.3) onLapComplete(toSec(d.lastTime));
    S.lastLapPct = p;
    // sem shift(): empilharPonto reduz a resolucao em vez de descartar o
    // inicio da volta, que e' o que fazia a delta desaparecer no primeiro
    // quarto da pista. Ver static/tempos.js.
    S.lapPct = empilharPonto(S.lapPct, p, curSec, 12000);
    if (d.lastSectorTime && d.lastSectorTime !== '--:--.---') {
      const st = toSec(d.lastSectorTime);
      const si = (d.sector || 1) - 1;
      if (si >= 0 && (S.sectorTimes[si] == null || st < S.sectorTimes[si])) {
        S.sectorTimes[si] = d.lastSectorTime;
        if (S.bestSectorTimes[si] == null || st < S.bestSectorTimes[si]) S.bestSectorTimes[si] = st;
      }
    }
    const dl = computeDelta(p, curSec);
    pintarDelta($('t-delta'), dl);
    $('lap-progress').style.width = clamp(p * 100, 0, 100) + '%';
  }
  renderSectors(d);

  // clima e pneu
  pintarClima(d);
  pintarPneu(d);

  // pedais
  pushTrace(d);
  setTxt('v-throttle', Math.round(d.throttle || 0));
  setTxt('v-brake', Math.round(d.brake || 0));
  setTxt('v-clutch', Math.round(100 - (d.clutchRaw != null ? d.clutchRaw : 1) * 100));
  const hb = $('v-handbrake');
  if (hb) hb.textContent = d.handbrake != null ? Math.round(d.handbrake) : '—';
  // o volante e' desenhado no loop, a partir deste valor
  S.steer = num(d.steer);
  setTxt('v-steer', S.steer.toFixed(2));
  setTxt('v-steer2', S.steer.toFixed(2));

  // pneus e travões
  renderTyres('tyres', d);
  renderBrakes('brake-temp', d);
  renderBrakeBias(d);

  // combustivel
  //
  // A quantidade e a UNIDADE sao do modulo do jogo. Antes era
  // `d.fuelL || 0` e a letra "L" escrita a mao, e no F1 25 -- que manda
  // QUILOS -- dava "0.0 L" com 7,34 kg no deposito. Ver
  // `combustivelDoJogo()`.
  const comb = combustivelDoJogo(d);
  const pctComb = (comb && typeof comb.pct === 'number') ? comb.pct : d.fuelPct;
  setTxt('fuel-pct', Math.round(pctComb || 0));
  $('fuel-bar').style.width = clamp(pctComb || 0, 0, 100) + '%';
  setTxt('fuel-l', comb ? comb.txt + ' ' + comb.unidade : '—');
  renderCombustivel(d, comb);
  setTxt('temps', fmtTemp(d.airTemp || 0) + ' / ' + fmtTemp(d.roadTemp || 0) + ' ' + tUnit());
  const pe = $('pen-time');
  if (pe) {
    pe.textContent = d.penaltyTime > 0 ? '+' + d.penaltyTime + ' s'
      : d.penaltyFlag ? '!' : (d.penaltiesEnabled ? t('fuel.none') : '—');
    pe.className = (d.penaltyTime > 0 || d.penaltyFlag) ? 'alert' : '';
  }
  setTxt('ers-used', d.ersUsedThisLapKJ ? Math.round(d.ersUsedThisLapKJ) + ' kJ' : '—');

  // mapa: o plano da pista e' X-Z (ver nota acima).
  // Zona de DRS: o drsAvailable E' um flag de zona nalguns carros, mas
  // noutros fica a 1 quase sempre. Medido:
  //   Ferrari SF25 em Interlagos  -> 1 em 18.5% da volta, em duas zonas
  //                                  contiguas, e so a 262-312 km/h
  //   Red Bull RB21 em Suzuka     -> 1 em 98.9% do tracado, por igual
  //                                  nos cinco quintos (ou seja, nao e'
  //                                  flag de zona nenhuma)
  // Pintar sem confirmar dava a pista toda a verde num caso e a zona
  // certa no outro. Por isso o drsAvailable so e' aceite se ao fim de
  // uma volta parecer mesmo uma zona; ate la, pinta-se a mao.
  // So' grava o mapa com a sessao MESMO a correr.
  //
  // Sem esta guarda, com o jogo fechado o site continuava a encher o mapa:
  // mediram-se 7383 pontos quase todos a tremer meio metro em torno da
  // mesma posicao congelada, mais uns quantos teletransportes. A posicao
  // parada passa o filtro dos 0,3 m do pushMapPoint porque a telemetria
  // publication tremula, e o traçado enche-se de ruido.
  //
  // Em PAUSA e no menu o packetId tambem para, portanto 'live' e' falso e o
  // mapa fica como estava -- que e' o que se quer ver.
  if (d.connected && d.live) {
    pushMapPoint(d.x, d.z, S.marking ? 1 : (S.drsAuto ? (d.drsAvailable ? 1 : 0) : 0),
      d.sector, d.drsAvailable);
  }
  // velocidade amortecida para o zoom da vista relativa. So' quando ha'
  // telemetria a serio: com o jogo fechado a velocidade e' 0 e a media
  // puxaria o zoom para o estado parado, em vez de o deixar como esta.
  if (d.connected) {
    const v = Math.abs(d.speed || 0);
    S.velSuave = S.velSuave + (v - S.velSuave) * 0.06;
  }
  setTxt('trackpct', (clamp(d.trackPct || 0, 0, 1) * 100).toFixed(1) + '%');
  setTxt('sector', t('sector') + ' ' + ((d.sector || 0) + 1) + (d.sectorCount ? '/' + d.sectorCount : ''));

  // modo misto
  setTxt('b-speed', fmtSpeed(d.speed || 0));
  setTxt('b-gear', d.gear || 'N');
  setTxt('b-rpm', d.rpm || 0);
  $('b-rpm-fill').style.width = (100 - clamp((d.rpm || 0) / (d.maxRpm || 12000) * 100, 0, 100)) + '%';
  pintarErs('b-l-ers', 'b-ers-bar', d);
  setLight('b-l-pit', d.pitLimiter ? t('state.lim') : d.isInPit ? t('lb.pit') : '—',
    d.pitLimiter ? 'bad' : d.isInPit ? 'warn' : '');
  setTxt('b-trackpct', (clamp(d.trackPct || 0, 0, 1) * 100).toFixed(1) + '%');
  setTxt('b-sector', t('sector') + ' ' + ((d.sector || 0) + 1) + (d.sectorCount ? '/' + d.sectorCount : ''));
  renderTyres('tyres2', d);
  renderBrakes('brake-temp2', d);

  // modo leaderboard: faixa do teu carro
  setTxt('m-speed', fmtSpeed(d.speed || 0));
  setTxt('m-gear', d.gear || 'N');
  $('m-rpm').style.width = pct + '%';
  setTxt('m-current', d.currentTime || '--:--.---');
  $('m-current').classList.toggle('empty', !d.currentTime || d.currentTime.indexOf('--') === 0);
  pintarDelta($('m-delta'), computeDelta(d.trackPct || 0, curSec == null ? 0 : curSec));
  setTxt('m-pen', d.penaltyTime > 0 ? '+' + d.penaltyTime + ' s' : (d.penaltiesEnabled ? t('fuel.none') : '—'));
  setTxt('m-drs', !d.hasDRS ? '—' : dr.on ? t('drs.open') : dr.avail ? t('drs.avail') : t('drs.off'));
  setTxt('m-brake', (d.brakeTemp || []).map((v) => fmtTemp(v)).join(' ') || '—');
  // O combustivel tambem vem do modulo, e pela mesma razao do modo
  // central: `d.fuelL` no F1 25 dava "0 L" com 7,34 kg no deposito.
  const mComb = combustivelDoJogo(d);
  setTxt('m-fuel', mComb
    ? Math.round(mComb.pct || 0) + '% · ' + mComb.txt + ' ' + mComb.unidade
    : '—');
  renderTyres('tyres3', d);

  lastD = d;
}

/* ------------------------------------------------------------ adversarios */
let myCarId = null;

/* O canal dos adversarios vai a 10 Hz (100 ms) e o ecra a 60. Desenhar o
   ultimo valor recebido faz a bola saltar 7 metros de cada vez a 250 km/h
   -- e foi isso que se viu no mapa: uma bola "tesa" a dar solavancos.
 *
 * A correcao e' a mesma que se usa em qualquer jogo com rede: guardar as
 * ultimas posicoes e DESENHAR NO PASSADO. Com um atraso de 130 ms ha'
 * sempre duas amostras que encadram o instante que se quer mostrar, e a
 * posicao interpola-se entre elas. O movimento fica suave a 60 fps sem
 * mandar mais dados.
 *
 * Nao se baixa para a interpolacao: se um adversario teleportar (mudanca
 * de sessao, reposicao na grelha) nao se desenha uma bola a correr pelo
 * mapa -- corta-se o troco e salta-se para a posicao nova. E o mesmo
 * limiar de 40 m que o mapa ja usa para nao ligar um ponto ao seguinte.
 */
const OPP_ATRASO_MS = 130;
const OPP_MAX_AMOSTRAS = 4;
const OPP_SALTO_M = 40;

function oppChave(c) {
  return (c.id != null ? 'id' + c.id : 'n' + (c.name || '') + '_' + (c.pos || ''));
}

function guardarOppHist(o) {
  const agora = performance.now();
  const vistos = new Set();
  for (const c of o.cars) {
    if (typeof c.x !== 'number' || typeof c.z !== 'number') continue;
    const k = oppChave(c);
    vistos.add(k);
    let h = S.oppHist[k];
    if (!h) { h = S.oppHist[k] = []; }
    // o id tem de vir aqui. Sem ele, opponentsSuaves devolvia id=null, a
    // comparacao com o teu carro nunca era verdadeira e aparecia uma bola
    // cinzenta em cima da amarela -- que e' o que se viu no mapa.
    h.push({ t: agora, id: c.id, x: c.x, z: c.z, pos: c.pos, name: c.name, inPit: c.inPit });
    while (h.length > OPP_MAX_AMOSTRAS) h.shift();
  }
  // limpa o que deixou de aparecer, mas so depois de um segundo sem
  // ver o carro -- uma falha de um pacote nao deve apagar o historico
  for (const k of Object.keys(S.oppHist)) {
    if (vistos.has(k)) continue;
    const h = S.oppHist[k];
    if (h.length && agora - h[h.length - 1].t > 1000) delete S.oppHist[k];
  }
}

/* Devolve a lista de adversarios com a posicao interpolada no instante
   pedido. Sem bracket (stream parado) fica na ultima posicao conhecida. */
function opponentsSuaves(alvo) {
  const out = [];
  for (const k of Object.keys(S.oppHist)) {
    const h = S.oppHist[k];
    if (!h.length) continue;
    let x = h[h.length - 1].x, z = h[h.length - 1].z;
    for (let i = h.length - 1; i > 0; i--) {
      const a = h[i - 1], b = h[i];
      if (alvo >= a.t && alvo <= b.t) {
        const dt = b.t - a.t;
        // um salto grande NAO se interpola: e' um teleporte
        if (dt > 0 && Math.abs(a.x - b.x) + Math.abs(a.z - b.z) < OPP_SALTO_M) {
          const f = (alvo - a.t) / dt;
          x = a.x + (b.x - a.x) * f;
          z = a.z + (b.z - a.z) * f;
        } else {
          x = b.x; z = b.z;
        }
        break;
      }
    }
    const ult = h[h.length - 1];
    out.push({ id: ult.id != null ? ult.id : null, x: x, z: z, pos: ult.pos, inPit: ult.inPit });
  }
  return out;
}

function renderOpponents(o) {
  if (!o) return;
  // a mesma defesa do render(): um nao-finite nao e' um dado (ver sanear)
  if (Array.isArray(o.cars)) {
    for (const car of o.cars) {
      if (!car || typeof car !== 'object') continue;
      for (const k in car) {
        if (typeof car[k] === 'number' && !isFinite(car[k])) car[k] = undefined;
      }
    }
  }
  o = sanear(o);
  S.opponents = o;
  if (o.available && Array.isArray(o.cars)) {
    guardarOppHist(o);
    // O TEU carro e' o veiculo 0 da pagina de adversarios do AC. O
    // 'focus' que o servidor manda e' o focusVehicle, que e' a CAMERA --
    // numa corrida coincide com o 0 porque a camera esta' no teu carro, mas
    // num replay e' outro carro altogether, e comparar os dois dava
    // resultados que dependiam do que se estava a ver.
    // Se a lista nao trouxer o id 0 (versao antiga do plugin), cai para o
    // focus em vez de nao riscar nenhum.
    S.localCarId = o.cars.some((c) => c.id === 0) ? 0
      : (o.focus != null ? o.focus : null);
  }
  const rows1 = $('lb-rows'), rows2 = $('lb-rows2');
  const note1 = $('lb-note'), note2 = $('lb-note2');
  // A versao compacta (sem intervalo nem ultima volta) e' so para o modo
  // misto, onde a leaderboard parte a largura com a telemetria. deciding
  // pelo facto de o elemento #lb-rows2 existir no markup nao servia --
  // ele existe sempre, mesmo escondido, e por isso a vista de
  // leaderboard mostrava sempre 4 colunas em vez de 6.
  const compact = (DEF.mode || 'telemetry') === 'both';

  if (!o.available || !o.cars || o.cars.length === 0) {
    // A app engole excepcoes de proposito, e por isso publica as falhas
    // na pagina. Sem isto, uma falha dentro do jogo aparecia como "a
    // aguardar os adversarios" mais a instrucao para ligar a app no
    // Content Manager -- quando a app ESTAVA ligada, e a escrever. A
    // instrucao era errada, e era a unica que havia.
    const falhou = o.available && o.errorCount > 0;
    let msg;
    if (falhou) {
      const oQue = o.lastError || '?';
      msg = '<b>' + t('opp.errTitle') + '</b><br>'
        + '<code>' + String(oQue).replace(/[<>&]/g, (c) => (
          { '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c])) + '</code><br>'
        + t('opp.err') + ' (' + o.errorCount + ')';
    } else {
      msg = '<b>' + t('opp.waiting') + '</b><br>' + t('opp.how');
    }
    [rows1, rows2].forEach((r) => { if (r) r.innerHTML = ''; });
    [note1, note2].forEach((n) => {
      if (n) {
        n.innerHTML = o.available && !falhou ? t('opp.none') : msg;
        n.classList.remove('hidden');
      }
    });
    return;
  }
  [note1, note2].forEach((n) => { if (n) n.classList.add('hidden'); });

  myCarId = o.focus;
  // o melhor tempo do jogador, para calcular diferencas
  let leaderBest = 0;
  let sessaoMelhor = 0;   // a melhor volta de toda a corrida, para destacar
  for (const c of o.cars) {
    const s = toSec(c.best);
    if (s != null) {
      if (leaderBest === 0 || s < leaderBest) leaderBest = s;
      if (sessaoMelhor === 0 || s < sessaoMelhor) sessaoMelhor = s;
    }
  }
  const me = o.cars.find((c) => c.id === myCarId) || null;

  /* A posicao do jogador, lida da MESMA lista que a linha dele mostra.
   * Ver o comentario do cabeçalho: dois campos para o mesmo facto e'
   * o que fazia as duas metades do ecrã discordarem. */
  S.posLista = me ? me.pos : null;
  const tl = (lastD && lastD.trackLength) || 0;

  /* Flash de "nova melhor volta", inspirado no aviso que o CMRT mostra
   * quando alguem bate o fastest lap da sessao. Aqui e' so' visual: quando
   * 'sessaoMelhor' desce, guarda-se quem foi (o carro cujo 'best' bate
   * com o novo valor) e durante 2,5 s a celula dele na leaderboard pisca.
   * Nao ha' som nem texto -- so' o marcador ja existente (.lb-best.top)
   * a chamar mais a atencao no momento em que muda. */
  if (sessaoMelhor > 0 && (S.sessaoMelhorAnterior == null || sessaoMelhor < S.sessaoMelhorAnterior - 1e-6)) {
    const quem = o.cars.find((c) => toSec(c.best) === sessaoMelhor);
    S.novoMelhorId = quem ? quem.id : null;
    S.novoMelhorEm = performance.now();
  }
  S.sessaoMelhorAnterior = sessaoMelhor > 0 ? sessaoMelhor : S.sessaoMelhorAnterior;
  const aFlash = S.novoMelhorId != null && (performance.now() - S.novoMelhorEm) < 2500;

  /* O INTERVALO AO VIVO, a ideia veio do leaderboard do Content Manager.
   *
   * Antes a coluna "Dif." era a diferenca entre as melhores voltas: um
   * numero que so muda quando alguem improve o melhor tempo, e que nao
   * responde a pergunta que se faz a correr -- "quanto tempo falta para
   * o apanhar".
   *
   * O CSP calcula-o a partir da posicao na pista e do ritmo. Aqui o ritmo
   * do adversario e' o da sua ultima volta (ultima / comprimento da
   * pista); o CSP tem a volta completa de cada carro e sabe o tempo
   * exacto. Isto e' uma aproximacao e esta escrito como tal.
   */
  const ritmoDe = (c) => {
    const t = toSec(c.last) != null ? toSec(c.last) : toSec(c.best);
    return (t != null && t > 0 && tl > 0) ? t / tl : null;
  };

  /* Para cada carro, o intervalo e' calculado contra quem esta' a serio
     a frente dele na pista -- que nem sempre e' o de cima na lista, se
     alguem tiver largado mais atras e ja estiver a passar. */
  const intervaloDe = (c) => {
    // O jogador tambem tem intervalo. Antes devolvia '-' a cena, por
    // desenho, com a ideia de que o que interessa ao jogador e' o delta
    // para a referencia e nao o intervalo. Mas esse e' exactamente o
    // numero que responde a "quanto tempo falta para o apanhar", que e'
    // uma pergunta normal a meio de uma corrida. Calculado como o dos
    // outros, sem caso especial.
    let melhor = null, melhorD = Infinity;
    for (const o2 of o.cars) {
      if (o2.id === c.id) continue;
      // quem esta' a frente: mais voltas, ou mais percentagem na mesma volta
      const dl = o2.lap - c.lap;
      const dp = o2.pct - c.pct;
      if (dl < 0) continue;
      if (dl === 0 && dp <= 0) continue;
      const d = dl + dp;
      if (d > 0 && d < melhorD) { melhorD = d; melhor = o2; }
    }
    if (!melhor) return { txt: '-', atrasado: false };

    // mesma volta: o traco do carro da frente diz exactamente quanto
    // tempo ele levou a chegar onde o de tras esta' agora - e' o mesmo
    // ponto da pista, so' que em instantes diferentes. So' cai para a
    // media de ritmo (abaixo) quando o traco ainda nao chega la' (carro
    // acabou de comecar a volta, ou faltaram pacotes).
    if (melhor.lap === c.lap) {
      const exato = intervaloPreciso(S.oppTracos, melhor.id, c.pct);
      if (exato != null) {
        const s = Math.max(0, exato);
        return { txt: s < 0.05 ? '0.0' : s.toFixed(1), atrasado: false };
      }
    }

    const r = intervaloAoVivo({
      trackLength: tl,
      lapF: melhor.lap, pctF: melhor.pct,
      lapT: c.lap, pctT: c.pct,
      velT: c.speed, ritmoF: ritmoDe(melhor)
    });
    if (!r) return { txt: '-', atrasado: false };
    if (r.voltas !== 0) return { txt: 'L ' + (r.voltas > 0 ? '+' : '') + r.voltas, atrasado: r.voltas < 0 };
    const s = r.seg;
    if (s < 0.05) return { txt: '0.0', atrasado: false };
    return { txt: s.toFixed(1), atrasado: false };
  };

  /* As setas de posicao. O jogo da' a posicao a cada instante mas nao a
     de largada, por isso registamos a primeira de cada carro -- mas so'
     no frame em que a corrida arranca. Guardar em todos os frames
     repunha a referencia 60 vezes por segundo e as setas nunca
     apareciam. */
  const corridaAtiva = !!(lastD && lastD.live && lastD.session === 'CORRIDA');
  if (corridaArranca(S.posicoes, corridaAtiva)) {
    S.posicoes.inicio = {};
    // a largada tambem apaga os tracos: o traco de antes da corrida (grid,
    // volta de formacao) nao serve de referencia para o intervalo em pista
    S.oppTracos = novoRastreadorTracos();
  }
  const agora = performance.now() / 1000;
  for (const c of o.cars) registarPosicoes(S.posicoes, c.id, c.pos, agora);

  // traco da volta em curso de cada carro (ver intervaloPreciso). O canal
  // dos adversarios vai a 10 Hz, que chega perfeitamente para isto - nao
  // e' preciso o mesmo detalhe da propria volta do jogador.
  for (const c of o.cars) {
    const seg = toSec(c.cur);
    if (seg != null) registarTraco(S.oppTracos, c.id, c.pct, seg, c.lap);
  }

  const html = o.cars.map((c) => {
    const best = toSec(c.best);
    const int = intervaloDe(c);
    const dPos = diferencaPosicao(S.posicoes, c.id, c.pos);
    const isMe = c.id === myCarId;
    const seta = dPos > 0 ? '<i class="lb-up" title="+' + dPos + '">▲</i>'
      : dPos < 0 ? '<i class="lb-down" title="' + dPos + '">▼</i>' : '';
    // etiqueta de estado: e' o que o CSP escreve a direita da linha
    const estado = !c.connected ? '<b class="lb-flag off">OFF</b>'
      : c.inPitLane ? '<b class="lb-flag pit">PIT</b>' : '';
    const melhorSessao = best != null && sessaoMelhor > 0 && best <= sessaoMelhor;
    const flashAqui = aFlash && c.id === S.novoMelhorId;
    const cols = compact
      ? '<span class="lb-pos" title="' + t('lb.posTitle')
          + ' ' + (c.posOficial || '-') + '">' + (c.pos || '-') + seta + '</span>' +
        '<span class="lb-name">' + esc(c.name) + '<small>' + esc(c.car) + '</small></span>' +
        '<span class="lb-lap">' + (c.lap + 1) + estado + '</span>' +
        '<span class="lb-gap' + (int.atrasado ? ' pos' : '') + '">' + int.txt + '</span>'
      : '<span class="lb-pos" title="' + t('lb.posTitle')
          + ' ' + (c.posOficial || '-') + '">' + (c.pos || '-') + seta + '</span>' +
        '<span class="lb-name">' + esc(c.name) + '<small>' + esc(c.car) + '</small></span>' +
        '<span class="lb-lap">' + (c.lap + 1) + estado + '</span>' +
        '<span class="lb-gap' + (int.atrasado ? ' pos' : '') + '" title="' + t('lb.intTitle') + '">' + int.txt + '</span>' +
        '<span class="lb-time"' + splitsTitle(c) + '>'
        + (isMe && c.cur ? c.cur : (c.last || '--')) + '</span>' +
        '<span class="lb-best' + (melhorSessao ? ' top' : '') + (flashAqui ? ' newbest' : '') + '">' + (c.best || '--') + '</span>';
    return '<div class="lb-row' + (isMe ? ' me' : '') + (c.inPit ? ' pit' : '') + '">' + cols + '</div>';
  }).join('');

  if (rows1) rows1.innerHTML = html;
  if (rows2) rows2.innerHTML = html;
}
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

/* Tooltip com os setores da ultima volta do carro, vindos da app do
   SimHub (ver acshm.py / SimHub.py). Sem eles (plugin antigo, ou o carro
   ainda nao fechou uma volta) devolve string vazia -- sem title="", o
   navegador nao mostra tooltip nenhum, o que e' o comportamento certo. */
function splitsTitle(c) {
  if (!Array.isArray(c.splits) || !c.splits.length) return '';
  const partes = c.splits.map((s, i) => 'S' + (i + 1) + ' ' + (s || '--:--.---'));
  return ' title="' + esc(partes.join('  ·  ')) + '"';
}


/* ------------------------------------------------------------ loop */
function loop() {
  const mode = DEF.mode || 'telemetry';
  if (DEF.map !== 'off') {
    if (mode === 'telemetry') drawMap('map');
    else if (mode === 'both') drawMap('map2');
  }
  if (mode === 'telemetry') { drawPedals('pedals'); drawVolante('wheel', S.steer); }
  else if (mode === 'both') { drawPedals('pedals2'); drawVolante('wheel2', S.steer); }
  requestAnimationFrame(loop);
}

/* ------------------------------------------------------------ arranque */
/* O ecra de escolha do jogo, e a ligacao ao modulo.
 *
 * Este e' o unico sitio do `app.js` que sabe que ha' mais do que um
 * jogo, e ele delega tudo no `Jogos` (`static/jogos/seletor.js`). O que
 * fica aqui e' o que e' FRONTEND: desenhar os botoes, por a nota da
 * instrucao correcta ao lado, e abrir e fechar o ecra.
 *
 * ---------------------------------------------------------------------------
 * A ORDEM DO ARRANQUE, E POR QUE ESTA NESTA
 * ---------------------------------------------------------------------------
 * Nao e' arbitraria, e cada passo esta' aqui por causa de uma coisa que
 * dava errado na ordem contraria:
 *
 *   1. as DEFINICOES locais, para o painel saber o idioma e as unidades
 *      ANTES de pintar seja o que for. Sem isto, o primeiro frame
 *      aparece em ingles -- porque as traducoes ainda nao foram
 *      aplicadas -- e salta para o portugues um instante depois. E'
 *      um salto visivel que se nota a cada arranque.
 *
 *   2. a LISTA DE JOGOS, que vem do servidor. E' a unica ida e volta que
 *      bloqueia, e bloqueia por uma razao: um ecra de escolha com um
 *      botao a menos e' melhor do que um ecra de escolha que promete um
 *      jogo que o servidor nao tem. Escrever os dois botoes no HTML
 *      seria mostrar ao utilizador um jogo que o servidor nao conhece.
 *
 *   3. o JOGO. Se ja' ha' escolha guardada, aplica-se sem perguntar; se
 *      nao ha', mostra-se o ecra. E' este o passo que decide que modulo
 *      fica carregado.
 *
 * E o SSE so' e' ligado DEPOIS do passo 3, nunca antes. Ligar a
 * telemetria antes de saber o jogo e' ouvir o AC e estar a pintar o
 * F1 25 -- e nao ha' nenhum sinal de erro no ecra, porque os dois estao
 * a falar do mesmo `Hub`. E' a mesma classe de bug da Regra no 16, com
 * duas vistas do mesmo mundo e convencoes diferentes. */
function montarEcraJogos(notaDeDesacordo) {
  const lista = document.getElementById('jogos-lista');
  const nota = document.getElementById('jogos-nota');
  if (!lista) return;
  const hoje = globalThis.Jogos.lista.jogos;
  if (!hoje || !hoje.length) {
    /* O servidor respondeu e nao tem jogos. Nao se inventa uma lista
     * aqui: um botao para um jogo que o servidor nao tem e' um botao que
     * nao faz nada, e nao faz nada sem dizer porquê. */
    if (nota) nota.innerHTML = notaDeDesacordo || esc(t('jog.semJogos'));
    return;
  }
  lista.innerHTML = hoje.map((j) => {
    /* O botao diz o que e' preciso fazer para aquele jogo aparecer.
     *
     * Escolher mal e' mais barato do que escolher e nao ver nada, e um
     * painel vazio sem instrucao e' a pior das tres situacoes: nao se
     * sabe se o jogo esta' ligado, se o socket esta' aberto, ou se a app
     * nao esta' instalada. Sao tres instrucoes completamente diferentes,
     * e trocar uma pela outra e' a forma mais rapida de perder a
     * confianca de quem esta' a tentar usar isto. */
    const extra = j.precisaInstalar
      ? '<small class="jogo-nota">' + esc(j.precisaInstalar ? t('jog.precisaInstalar') : '') + '</small>'
      : '';
    return '<button class="menu-card jogo-card" data-jogo="' + esc(j.id) + '">' +
      '<span class="mc-ico" aria-hidden="true"><svg viewBox="0 0 40 28">' +
      '<circle cx="13" cy="14" r="8" fill="none" stroke="currentColor" stroke-width="2.4"/>' +
      '<circle cx="13" cy="14" r="2.4" fill="currentColor"/>' +
      '<path d="M21 14h14M30 8v12" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>' +
      '</svg></span>' +
      '<b>' + esc(j.nome) + '</b>' +
      '<small>' + esc(j.transporte || '') + '</small>' + extra +
      '</button>';
  }).join('');
  lista.querySelectorAll('button[data-jogo]').forEach((b) => {
    b.addEventListener('click', () => {
      const id = b.getAttribute('data-jogo');
      fecharEcraJogos();
      globalThis.Jogos.escolher(id).then(arrancarAposEscolher);
    });
  });
}

/* ESCOLHER O JOGO TAMBIM DESDE O ECRA DE ESPERA.
 *
 * Faltava a linha que esconde o `#boot`, e e' a mesma que o `showMenu()`
 * ja' tem. Sem ela o ecra de escolha abre POR BAIXO do ecra de espera: o
 * boot e' `z-index:60` e o overlay e' `z-index:50`, e quem abre a pagina
 * ve "A aguardar o jogo" por cima de uns botoes que nao aparecem.
 *
 * Medido no browser antes da correccao:
 *
 *     #boot     VISIVEL 1223x886   z-index 60
 *     #jogos    VISIVEL 1223x886   z-index 50
 *     main.app  display:none
 *
 * E o `main.app` estava `display:none` porque o painel so aparece depois
 * de escolhida a VISTA -- por isso o `#btn-jogo` do cabecalho, que se
 * acabou de ligar, tinha zero de tamanho e nao tinha onde ser clicado.
 * Ligar o botao foi preciso e nao chegou.
 *
 * O `z-index` nao se mexe: o `60` do boot e' o que o poe a cima de tudo, e
 * isso e' certo para uma espera. O que estava errado e' o boot continuar
 * visivel por cima de um ecra que se abriu depois dele. */
function abrirEcraJogos(nota) {
  montarEcraJogos(nota);
  const e = document.getElementById('jogos');
  if (e) e.classList.remove('hidden');
  $('boot').classList.add('hidden');
  /* `inert` e' "isto nao aceita cliques nem foco". NAO e' uma marcacao
   * de "isto e' modal" -- e o `showMenu()` tem o modelo, e e' o contrario
   * disto:
   *
   *     $('app').inert = true;      // a APLICACAO de baixo
   *
   * Um ecra `aria-modal` tem de ser INTERACTIVEL, e o que esta' por baixo
   * e' que nao entra na tabulacao. Tive-o ao contrario, e o resultado foi
   * um ecra de escolha que se via e nao se podia clicar: os cartoes tinham
   * 453x181 e o clique no centro acertava o `<body>`.
   *
   * Nao da' erro nenhum, que e' o que faz isto passar sem o dizer: os ids
   * existem todos, o ecra tem tamanho, e os 33 grupos da suite passam.
   * Um `inert` no sitio errado e' invisivel para tudo o que nao abrir o
   * browser e clicar. */
  $('app').inert = true;
  $('jogos').inert = false;
  if (globalThis.FecharGavetaAberta) globalThis.FecharGavetaAberta();
}
/* Fechar o ecra de escolha VOLTA ao ecra de espera, e nao ao painel.
 *
 * Sem isto, fechar o ecra de escolha deixava o ecra inteiro a vazio: nem
 * o painel, que so aparece depois de escolhida a vista, nem a espera, que
 * esconder ja' estava. O ecra de espera e' o estado HONESTO depois de
 * escolher um jogo que ainda nao da' telemetria -- e' o que diz que o
 * painel esta' vivo e a espera pelo jogo. */
function fecharEcraJogos() {
  const e = document.getElementById('jogos');
  if (e) e.classList.add('hidden');
  $('app').inert = false;
  $('boot').classList.remove('hidden');
}

/* O nome do jogo no rodape.
 *
 * E' o unico sitio onde se diz de que jogo se esta' a falar, e e' o que
 * impede a confusao de um painel que mostra o F1 25 com a telemetria do
 * AC por tras. Um painel sem isto mostra os mesmos numeros nos dois
 * jogos, e quem os conhece nao sabe qual esta' a ver. */
function mostrarJogoNaInterface() {
  const m = globalThis.Jogos.atual();
  const el = document.getElementById('foot-jogo');
  if (el && m) el.textContent = m.nome;

  /* O ESQUEMA DAS DEFINICOES DEPENDE DO JOGO, e esta e' a unica linha
   * que lho diz.
   *
   * O AC publica litros e o F1 25 publica quilos, e o F1 25 nao publica
   * vento. Quem publica a unidade e' o modulo do jogo -- e' ele que sabe
   * de que campo o numero veio -- e o `defs.js` nao tem uma tabela
   * "unidades por jogo" porque isso seria um segundo sitio a saber o
   * que cada jogo manda, ao lado do modulo que ja' o diz.
   *
   * E ANTES de validar, nunca depois. O que se validou contra as
   * unidades do jogo anterior e' um valor que ja' nao e' legal, e
   * guardar esse valor e' a forma de o painel pintar "1.0 lb" a partir
   * de um numero em litros. O que a `validar` devolve e' a unidade que
   * o jogo manda, porque e' a unica que tem significado antes de haver
   * uma medicao. Regra no 24. */
  if (m && m.UNIDADES) {
    Defs.usarJogo(m.id, m.UNIDADES);
    DEF = Defs.validar(DEF);
    saveDef();
    applyUnits();
  }

  /* A SEGUNDA linha do rodape' tambem descreve o jogo, e por isso tambem
   * e' por jogo. Era um texto fixo -- "memoria do AC, sem SimHub" nos
   * quatro idiomas -- que ficava no ecra' com o F1 25 escolhido, ao lado
   * de "F1 25" na primeira. Duas linhas a dizer de que jogo se trata, uma
   * certa e outra errada, e a errada e' a que tem a forma de frase: e' a
   * que se le sem reparar.
   *
   * A correccao e' `foot.src.<id>`, e nao texto tirado do modulo do jogo,
   * porque a traducao vive em UM sitio (a skill `documentacao` diz que
   * e' o `app.js`) e partida por jogos deixaria de se contar o I18N
   * inteiro. E o `auditar_frontend.py` passa a exigir a chave nos quatro
   * idiomas para cada jogo registado.
   *
   * Se a chave faltar, fica o texto cru do jogo em vez de uma frase de
   * outro: e' feio, mas nao e' uma mentira. */
  const id = globalThis.Jogos.idAtivo();
  const info = (globalThis.Jogos.lista.jogos || [])
    .find((j) => j.id === id);
  const elSrc = document.getElementById('foot-src');
  if (elSrc) {
    const txt = t('foot.src.' + id);
    // o `transporte` vem da lista e nao do modulo: `Jogos.atual()` sao
    // as REGRAS do jogo, e nao os dados de como se le o jogo.
    elSrc.textContent = (txt === 'foot.src.' + id)
      ? ((info && info.transporte) || '')
      : txt;
  }

  document.querySelectorAll('#set-jogo button').forEach((b) => {
    b.classList.toggle('on', b.getAttribute('data-v') === globalThis.Jogos.idAtivo());
  });
  const nota = document.getElementById('set-jogo-nota');
  if (nota) {
    nota.textContent = (info && info.instrucao) ? info.instrucao : '';
  }
}

function montarDefinicoesJogo() {
  const host = document.getElementById('set-jogo');
  if (!host) return;
  const hoje = globalThis.Jogos.lista.jogos;
  if (!hoje || !hoje.length) { host.innerHTML = ''; return; }
  host.innerHTML = hoje.map((j) =>
    '<button data-v="' + esc(j.id) + '">' + esc(j.nome) + '</button>').join('');
  host.querySelectorAll('button[data-v]').forEach((b) => {
    b.addEventListener('click', () => {
      /* Trocar de jogo a partir das definicoes NAO reinicia o painel: o
       * mapa continua (esta' no `localStorage`), as voltas de referencia
       * continuam, e a ligacao SSE continua. Perder tudo isso por trocar
       * de jogo seria o pior de trocar de jogo. */
      globalThis.Jogos.escolher(b.getAttribute('data-v'));
    });
  });
  mostrarJogoNaInterface();
}

function boot() {
  loadDef();
  applyLang();
  buildTyres('tyres');
  buildTyres('tyres2');
  buildTyres('tyres3');
  bindSettings();
  /* O BOTAO DE ESCOLHER O JOGO, que existia sem handler nenhum.
   *
   * O `#btn-jogo` estava no `index.html` desde o inicio, com icone,
   * com `aria-label` e com a chave `jog.abrir` nos quatro idiomas --
   * e sem um unico listener. O unico sitio que abria o ecra de escolha
   * era o arranque, e so na primeira vez, porque a escolha fica no
   * `localStorage` para sempre.
   *
   * O resultado era um painel que abria, nao perguntava nada, e ficava a
   * aguardar um jogo -- e sem caminho para trocar. O comentario do
   * proprio HTML diz que este botao e' "o unico sitio onde se troca de
   * jogo sem reiniciar o servidor", e ele nao fazia nada.
   *
   * Sem guarda: o ecra ja' esta' no HTML e `abrirEcraJogos` e'
   * idempotente -- chama-la duas vezes nao estraga nada. */
  $('btn-jogo').addEventListener('click', () => abrirEcraJogos());
  /* E O BOTAO DO ECRA DE ESPERA, que e' onde se chega na pratica.
   *
   * Durante a espera o ecra cobre tudo a `z-index:60`, e o `main.app`
   * esta' a `display:none` porque a vista ainda nao foi escolhida --
   * entao o `#btn-jogo` do cabecalho tem zero de tamanho e nao ha' nada
   * para clicar. Sem este botao, quem abre o painel com o jogo errado ve
   * uma roda a girar e nenhuma opcao. */
  $('boot-jogo').addEventListener('click', () => abrirEcraJogos());
  syncSettingsUI();
  applyMode();
  document.body.classList.remove('booting');

  globalThis.Jogos.lerLista().then(() => {
    montarDefinicoesJogo();
    const jaEscolheu = globalThis.Jogos.lista.escolha;
    const doServidor = globalThis.Jogos.lista.servidor;

    if (jaEscolheu && doServidor && jaEscolheu !== doServidor) {
      /* O SERVIDOR E' O BROWSER, E VAOO DIFERENTE.
       *
       * O servidor foi arrancado com `--jogo f125` na linha de comando:
       * essa e' a intencao de quem o arrancou, e e' explicita. O
       * `localStorage` e' do browser, e pode ser de uma sessao em que se
       * jogou o outro.
       *
       * A versao anterior reenviava a escolha do browser ao servidor, e o
       * servidor trocava -- em silencio. O comentario logo ao lado dizia
       * "quem ganha e' o servidor", e o codigo fazia o contrario. O
       * resultado era um painel a mostrar a telemetria de um jogo que
       * ninguem pediu, com o rodape' a dizer o nome desse jogo, e sem nada
       * no ecra' que explicasse porque.
       *
       * Um desacordo nao se resolve a adivinhar: pergunta-se. E a nota diz
       * qual dos dois esta' a mandar, para quem escolhe saber o que
       * estava a acontecer. */
      const nomeDe = (id) => {
        const j = (globalThis.Jogos.lista.jogos || []).find(x => x.id === id);
        return (j && j.nome) || id;
      };
      abrirEcraJogos(t('jog.divergencia')
        .replace('{jogo}', esc(nomeDe(doServidor)))
        .replace('{outro}', esc(nomeDe(jaEscolheu))));
    } else if (jaEscolheu) {
      /* Havia escolha guardada E o servidor esta' no mesmo jogo. Reenvia-se
       * na mesma, porque o `localStorage` e' do browser e o ficheiro de
       * definicoes e' do servidor: podem discordar, e quem ganha e' o
       * servidor. */
      globalThis.Jogos.escolher(jaEscolheu).then(arrancarAposEscolher);
    } else {
      /* NINGUEM jogo escolhido: o ecra de escolha e' a primeira coisa que
       * aparece. E nao o menu de vista, porque a vista e' uma escolha
       * MENOR e trocar de jogo depois obriga a recarregar a pagina. */
      abrirEcraJogos();
    }
  });
}

/* Tudo o que se liga depois de o jogo estar escolhido. */
let _jaArrancou = false;
function arrancarAposEscolher() {
  mostrarJogoNaInterface();
  if (_jaArrancou) return;      /* trocar de jogo nao reinicia nada */
  _jaArrancou = true;
  connectOpponents();
  connectTelemetry();
  loop();
  if (DEF.mode) {
    applyMode();
  } else {
    showMenu(true);
  }
  addFpsControl();
}

/* Os pontos que o seletor chama quando o jogo muda.
 *
 * Sao funcoes aqui dentro, e nao no seletor, porque sao de FRONTEND --
 * pintar ids, aplicar unidades, fechar um ecra. O seletor sabe que o
 * jogo mudou; nao sabe o que se pinta. Nenhum dos dois sabe do outro
 * para alem destes nomes, e e' por isso que trocar a ordem dos `<script>`
 * nao parte nada. */
globalThis.AplicarIdioma = function () { applyLang(); };
globalThis.AplicarUnidades = function () { applyUnits(); };
globalThis.RepintarTudo = function () { /* o proximo frame pinta */ };
globalThis.AplicarJogoNaInterface = mostrarJogoNaInterface;
globalThis.AbrirEcraJogos = abrirEcraJogos;
globalThis.FecharEcraJogos = fecharEcraJogos;
globalThis.MontarDefinicoesJogo = montarDefinicoesJogo;
globalThis.FecharGavetaAberta = function () {
  if (typeof fecharGaveta === 'function') fecharGaveta();
};

function addFpsControl() {

  const host = document.getElementById('set-fps-host');
  if (!host) return;
  host.innerHTML =
    '<h3>' + t('set.fps') + '</h3>' +
    '<div class="seg" id="set-fps">' +
    [10, 20, 30, 60].map((v) =>
      '<button data-v="' + v + '">' + v + ' fps</button>').join('') +
    '</div>';
  document.querySelectorAll('#set-fps button').forEach((b) => {
    b.classList.toggle('on', +b.getAttribute('data-v') === +DEF.fps);
    b.addEventListener('click', () => {
      DEF.fps = +b.getAttribute('data-v');
      saveDef(); syncFpsUI();
      connectTelemetry();          // reabre com o novo ritmo
    });
  });
}
function syncFpsUI() {
  document.querySelectorAll('#set-fps button').forEach((b) => {
    b.classList.toggle('on', +b.getAttribute('data-v') === +DEF.fps);
  });
}

window.addEventListener('resize', () => { /* os canvas reajustam no proximo frame */ });
document.addEventListener('DOMContentLoaded', boot);