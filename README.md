## Incorporar o visualizador 3D

Use a página pública de incorporação em um `iframe`:

```html
<iframe
  src="https://lapsumcriativo.vercel.app/embed/3d/?game=sa&amp;model=stallion"
  title="Visualizador 3D"
  width="100%"
  height="600"
  allow="fullscreen"
  loading="lazy"
  style="border: 0"
></iframe>
```

Os parâmetros `game` (`iii`, `vc` ou `sa`) e `model` selecionam o jogo e o
modelo. A incorporação é autorizada em páginas servidas por HTTPS. Para
compartilhar no Discord, use o link da página do modelo: o Discord mostra a
prévia do link, mas não executa o visualizador interativo dentro da mensagem.

### Placas do GTA San Andreas

O visualizador escolhe uma arte regional aleatória ao abrir a página e gera uma
combinação no formato `ABC 123` ao carregar cada veículo. Para cadastrar uma
placa fixa para um modelo, adicione uma entrada em `fixedPlatesByModel` no
arquivo `assets/js/rw_modelview/sa-plates.js`:

```js
"stallion": { region: "los-santos", text: "ABC 123" }
```

As regiões aceitas são `los-santos`, `san-fierro` e `las-venturas`. Modelos sem
uma entrada continuam usando caracteres aleatórios.

### Transição do Hero

Na página inicial, `hero_transition: blend` aplica um gradiente escuro sobre
a parte inferior da imagem do Hero, misturando-a com o fundo da página:

```yaml
hero_transition: blend
```

Este é o único efeito de transição disponível no momento. Remova a opção ou
use outro valor para exibir a imagem sem gradiente.