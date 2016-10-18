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

```
Meteor.publish('lists.private', function() {
  if (!this.userId) {
    return this.ready();
  }

  return Lists.find({
    userId: this.userId
  }, {
    fields: Lists.publicFields
  });
});
```
Thanks to the guarantees provided by DDP and Meteor's accounts system, the above publication can be confident that it will only ever publish private lists to the user that they belong to. Note that the publication will re-run if the user logs out (or back in again), which means that the published set of private lists will change as the active user changes.

In the case of a logged-out user, we explicitly call this.ready(), which indicates to the subscription that we've sent all the data we are initially going to send (in this case none). It's important to know that if you don't return a cursor from the publication or call this.ready(), the user's subscription will never become ready, and they will likely see a loading state forever.

Here's an example of a publication which takes a named argument. Note that it's important to check the types of arguments that come in over the network.

```
Meteor.publish('todos.inList', function(listId) {
  // We need to check the `listId` is the type we expect
  new SimpleSchema({
    listId: {type: String}
  }).validate({ listId });

  // ...
});
```
When we subscribe to this publication on the client, we can provide this argument via the Meteor.subscribe() call:
```
Meteor.subscribe('todos.inList', list._id);
```
*Organizing publications*

It makes sense to place a publication alongside the feature that it's targeted for. For instance, sometimes publications provide very specific data that's only really useful for the view for which they were developed. In that case, placing the publication in the same module or directory as the view code makes perfect sense.

Often, however, a publication is more general. For example in the Todos example application, we create a todos.inList publication, which publishes all the todos in a list. Although in the application we only use this in one place (in the Lists_show template), in a larger app, there's a good chance we might need to access all the todos for a list in other places. So putting the publication in the todos package is a sensible approach.

#Subscribing to data

To use publications, you need to create a subscription to it on the client. To do so, you call Meteor.subscribe() with the name of the publication. When you do this, it opens up a subscription to that publication, and the server starts sending data down the wire to ensure that your client collections contain up to date copies of the data specified by the publication.

Meteor.subscribe() also returns a "subscription handle" with a property called .ready(). This is a reactive function that returns true when the publication is marked ready (either you call this.ready() explicitly, or the initial contents of a returned cursor are sent over).
```
const handle = Meteor.subscribe('lists.public');
```
*Stopping Subscriptions*

The subscription handle also has another important property, the .stop() method. When you are subscribing, it is very important to ensure that you always call .stop() on the subscription when you are done with it. This ensures that the documents sent by the subscription are cleared from your local Minimongo cache and the server stops doing the work required to service your subscription. If you forget to call stop, you'll consume unnecessary resources both on the client and the server.

However, if you call Meteor.subscribe() conditionally inside a reactive context (such as an autorun, or getMeteorData in React) or via this.subscribe() in a Blaze component, then Meteor's reactive system will automatically call this.stop() for you at the appropriate time.

*Subscribe in UI components*

It is best to place the subscription as close as possible to the place where the data from the subscription is needed. This reduces "action at a distance" and makes it easier to understand the flow of data through your application. If the subscription and fetch are separated, then it's not always clear how and why changes to the subscriptions (such as changing arguments), will affect the contents of the cursor.

What this means in practice is that you should place your subscription calls in components. In Blaze, it's best to do this in the onCreated() callback:
```
Template.Lists_show_page.onCreated(function() {
  this.getListId = () => FlowRouter.getParam('_id');

  this.autorun(() => {
    this.subscribe('todos.inList', this.getListId());
  });
});
```
In this code snippet we can see two important techniques for subscribing in Blaze templates:

Calling this.subscribe() (rather than Meteor.subscribe), which attaches a special subscriptionsReady() function to the template instance, which is true when all subscriptions made inside this template are ready.

Calling this.autorun sets up a reactive context which will re-initialize the subscription whenever the reactive function this.getListId() changes.

Read more about Blaze subscriptions in the Blaze article, and about tracking loading state inside UI components in the UI article.

#Fetching data

Subscribing to data puts it in your client-side collection. To use the data in your user interface, you need to query your client-side collection. There are a couple of important rules to follow when doing this.

*Always use specific queries to fetch data*

If you're publishing a subset of your data, it might be tempting to simply query for all data available in a collection (i.e. Lists.find()) in order to get that subset on the client, without re-specifying the Mongo selector you used to publish that data in the first place.

But if you do this, then you open yourself up to problems if another subscription pushes data into the same collection, since the data returned by Lists.find() might not be what you expected anymore. In an actively developed application, it's often hard to anticipate what may change in the future and this can be a source of hard to understand bugs.

Also, when changing between subscriptions, there is a brief period where both subscriptions are loaded (see Publication behavior when changing arguments below), so when doing things like pagination, it's exceedingly likely that this will be the case.

*Fetch the data nearby where you subscribed to it*

We do this for the same reason we subscribe in the component in the first place---to avoid action at a distance and to make it easier to understand where data comes from. A common pattern is to fetch the data in a parent template, and then pass it into a "pure" child component, as we'll see it in the UI Article.

Note that there are some exceptions to this second rule. A common one is Meteor.user()---although this is strictly speaking subscribed to (automatically usually), it's typically over-complicated to pass it through the component hierarchy as an argument to each component. However keep in mind it's best not to use it in too many places as it makes components harder to test.

#Global subscriptions

One place where you might be tempted to not subscribe inside a component is when it accesses data that you know you always need. For instance, a subscription to extra fields on the user object (see the Accounts Article) that you need on every screen of your app.

However, it's generally a good idea to use a layout component (which you wrap all your components in) to subscribe to this subscription anyway. It's better to be consistent about such things, and it makes for a more flexible system if you ever decide you have a screen that doesn't need that data.
