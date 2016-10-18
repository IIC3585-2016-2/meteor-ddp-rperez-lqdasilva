# meteor-ddp-rperez-lqdasilva
Este repositorio contiene información sobre el protocolo de comunicación Distribuited Data Protocol(DDP). El objetivo principal es mostrar una breve definición del protocolo, los componentes básicos, y un ejemplo de como funciona el protocolo.

Antes de iniciar con la descripción del protocolo es importante contextualizar el framework sobre el cual trabaja este protocolo.
Meteor es una plataforma full-stack JavaScript para desarrollar aplicaciones web y mobile modernas. Meteor incluye un conjunto clave de tecnologías para construir aplicaciones reactivas conectadas al cliente. Más información se puede encontrar en el sitio oficial www.meteor.com.

Este protocolo es utilizado por el framework Meteor para manejar la persistencia de los datos y hacer posible
comunicación entre el cliente y la base de datos en el servidor. La comunicación es establecida mediante la 
tecnología Websocket y alternativamente utiliza sockJS para los navegadores que no soportan websocket.

El protocolo DDP tiene dos funciones principales:
1. Manejar llamados a procedimientos remotos
2. Gestionar datos, realizando acciones como: agregar, modificar y remover.

Una de las características del framework es que posee información detallada del funcionamiento del protocolo, por lo cual se utiliza un estracto de la información disponible en el repositorio de 

# Publications and subscriptions

In a traditional, HTTP-based web application, the client and server communicate in a "request-response" fashion. Typically the client makes RESTful HTTP requests to the server and receives HTML or JSON data in response, and there's no way for the server to "push" data to the client when changes happen at the backend.

Meteor is built from the ground up on the Distributed Data Protocol (DDP) to allow data transfer in both directions. Building a Meteor app doesn't require you to set up REST endpoints to serialize and send data. Instead you create publication endpoints that can push data from server to client.

In Meteor a publication is a named API on the server that constructs a set of data to send to a client. A client initiates a subscription which connects to a publication, and receives that data. That data consists of a first batch sent when the subscription is initialized and then incremental updates as the published data changes.

So a subscription can be thought of as a set of data that changes over time. Typically, the result of this is that a subscription "bridges" a server-side MongoDB collection, and the client side Minimongo cache of that collection. You can think of a subscription as a pipe that connects a subset of the "real" collection with the client's version, and constantly keeps it up to date with the latest information on the server.

#Defining a publication

A publication should be defined in a server-only file. For instance, in the Todos example app, we want to publish the set of public lists to all users:
```java
Meteor.publish('lists.public', function() {
  return Lists.find({
    userId: {$exists: false}
  }, {
    fields: Lists.publicFields
  });
});
```
There are a few things to understand about this code block. First, we've named the publication with the unique string lists.public, and that will be how we access it from the client. Second, we are simply returning a Mongo cursor from the publication function. Note that the cursor is filtered to only return certain fields from the collection, as detailed in the Security article.

What that means is that the publication will simply ensure the set of data matching that query is available to any client that subscribes to it. In this case, all lists that do not have a userId setting. So the collection named Lists on the client will have all of the public lists that are available in the server collection named Lists while that subscription is open. In this particular example in the Todos application, the subscription is initialized when the app starts and never stopped, but a later section will talk about subscription life cycle.

Every publication takes two types of parameters:

The this context, which has information about the current DDP connection. For example, you can access the current user's _id with this.userId.
The arguments to the publication, which can be passed in when calling Meteor.subscribe.
Note: Since we need to access context on this we need to use the function() {} form for publications rather than the ES2015 () => {}. You can disable the arrow function linting rule for publication files with eslint-disable prefer-arrow-callback. A future version of the publication API will work more nicely with ES2015.
In this publication, which loads private lists, we need to use this.userId to get only the todo lists that belong to a specific user.
