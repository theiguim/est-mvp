# Observatório de Eventos Municipais — MVP HTML/JS

Protótipo demonstrativo em **HTML, CSS e JavaScript puro**, criado para apresentação de orçamento e proposta à prefeitura.

O projeto simula um sistema para:

- cadastrar e editar eventos;
- adicionar perguntas extras ao questionário;
- cadastrar coletores;
- gerar links individuais de coleta;
- coletar respostas pelo celular;
- acompanhar dashboard com indicadores e gráficos;
- comparar eventos/edições;
- exportar respostas em CSV;
- exportar resumo em CSV;
- imprimir/salvar relatório em PDF pelo navegador;
- exportar o banco completo em JSON.

## Estrutura

```txt
observatorio-eventos-html/
├── index.html
├── styles.css
├── app.js
├── db.json
├── server.js
└── README.md
```

## Como rodar com salvamento em arquivo local

Essa é a melhor forma para apresentar e manter os dados dentro do Git.

Requisitos: Node.js instalado.

No terminal, dentro da pasta do projeto:

```bash
node server.js
```

Depois abra:

```txt
http://localhost:4173
```

Nesse modo, o sistema salva cadastros, edições, coletores, perguntas e respostas diretamente no arquivo:

```txt
db.json
```

Esse arquivo pode ser versionado no Git.

## Como rodar sem servidor

Você também pode abrir o `index.html` direto no navegador ou usar uma extensão como Live Server.

Nesse modo, por segurança do navegador, a página **não consegue gravar diretamente no arquivo `db.json`**. Então os dados ficam em `localStorage`.

Mesmo assim, você pode usar o botão:

```txt
Exportar JSON
```

E salvar o arquivo exportado manualmente no projeto.

## Por que existe `server.js`?

HTML/JS puro no navegador não tem permissão para escrever arquivos locais do projeto automaticamente. Isso é uma proteção do navegador.

Por isso o protótipo tem duas opções:

1. **Com servidor Node simples:** salva no `db.json` dentro do projeto.
2. **Sem servidor:** salva no navegador e permite exportar JSON.

O `server.js` não usa framework, banco externo nem dependências. É apenas JavaScript nativo do Node para servir os arquivos e gravar o `db.json`.

## Fluxo sugerido para apresentação

1. Abra a Visão Geral.
2. Mostre os indicadores do São João dos Queijos 2026.
3. Vá em Eventos.
4. Edite ou crie um novo evento.
5. Abra o detalhe do evento.
6. Mostre as abas:
   - Visão geral;
   - Questionário;
   - Coletores;
   - Dashboard;
   - Comparação;
   - Exportações.
7. Abra a aba Coletores e copie/abra um link de coleta.
8. Preencha uma entrevista pelo formulário mobile.
9. Volte ao dashboard e mostre a atualização dos dados.
10. Use Exportações para baixar CSV ou imprimir/salvar PDF.

## Observações para evolução em Next.js

Este protótipo foi desenhado para virar depois um sistema real com:

- Next.js;
- Supabase/PostgreSQL;
- autenticação;
- permissões por secretaria;
- persistência real;
- relatórios PDF mais completos;
- gráficos avançados;
- templates de questionário por secretaria;
- auditoria de respostas.

## Limitações intencionais do MVP

- Não há login real.
- Não há autenticação de servidor público.
- Não há banco relacional.
- Não há coleta offline.
- Os gráficos são feitos com HTML/CSS/SVG simples, sem bibliotecas externas.
- O QR Code não foi implementado para manter o protótipo sem dependências externas.

Essas limitações são boas para o MVP, porque mantêm o projeto leve, apresentável e fácil de evoluir.
