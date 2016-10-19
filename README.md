# meteor-ddp-rperez-lqdasilva
Este repositorio contiene información sobre el protocolo de comunicación Distribuited Data Protocol(DDP). El objetivo principal es mostrar una breve definición del protocolo, los componentes básicos, y un ejemplo de como funciona el protocolo.

Antes de iniciar con la descripción del protocolo es importante contextualizar el framework sobre el cual trabaja este protocolo.
Meteor es una plataforma full-stack JavaScript para desarrollar aplicaciones web y mobile modernas. Meteor incluye un conjunto clave de tecnologías para construir aplicaciones reactivas conectadas al cliente. Más información se puede encontrar en el sitio oficial www.meteor.com.

Este protocolo es utilizado por el framework Meteor para manejar la persistencia de los datos y hacer posible
comunicación entre el cliente y la base de datos en el servidor. La comunicación es establecida mediante la 
tecnología Websocket y alternativamente utiliza sockJS para los navegadores que no soportan websocket. Más información en https://www.websocket.org/ 

El protocolo DDP tiene dos funciones principales:
1. Manejar llamados a procedimientos remotos
2. Gestionar datos, realizando acciones como: agregar, modificar y remover.

Una de las características del framework es que posee información detallada del funcionamiento del protocolo, por lo cual se utiliza un estracto de la información disponible que consideramos más importante para enterder como trabaja el protocolo DDP.


# Publications and subscriptions

In a traditional, HTTP-based web application, the client and server communicate in a "request-response" fashion. Typically the client makes RESTful HTTP requests to the server and receives HTML or JSON data in response, and there's no way for the server to "push" data to the client when changes happen at the backend.

Meteor is built from the ground up on the Distributed Data Protocol (DDP) to allow data transfer in both directions. Building a Meteor app doesn't require you to set up REST endpoints to serialize and send data. Instead you create publication endpoints that can push data from server to client.

In Meteor a publication is a named API on the server that constructs a set of data to send to a client. A client initiates a subscription which connects to a publication, and receives that data. That data consists of a first batch sent when the subscription is initialized and then incremental updates as the published data changes.

So a subscription can be thought of as a set of data that changes over time. Typically, the result of this is that a subscription "bridges" a server-side MongoDB collection, and the client side Minimongo cache of that collection. You can think of a subscription as a pipe that connects a subset of the "real" collection with the client's version, and constantly keeps it up to date with the latest information on the server.

# Defining a publication

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
# Organizing publications

It makes sense to place a publication alongside the feature that it's targeted for. For instance, sometimes publications provide very specific data that's only really useful for the view for which they were developed. In that case, placing the publication in the same module or directory as the view code makes perfect sense.

Often, however, a publication is more general. For example in the Todos example application, we create a todos.inList publication, which publishes all the todos in a list. Although in the application we only use this in one place (in the Lists_show template), in a larger app, there's a good chance we might need to access all the todos for a list in other places. So putting the publication in the todos package is a sensible approach.

# Subscribing to data

To use publications, you need to create a subscription to it on the client. To do so, you call Meteor.subscribe() with the name of the publication. When you do this, it opens up a subscription to that publication, and the server starts sending data down the wire to ensure that your client collections contain up to date copies of the data specified by the publication.

Meteor.subscribe() also returns a "subscription handle" with a property called .ready(). This is a reactive function that returns true when the publication is marked ready (either you call this.ready() explicitly, or the initial contents of a returned cursor are sent over).
```
const handle = Meteor.subscribe('lists.public');
```
## Stopping Subscriptions

The subscription handle also has another important property, the .stop() method. When you are subscribing, it is very important to ensure that you always call .stop() on the subscription when you are done with it. This ensures that the documents sent by the subscription are cleared from your local Minimongo cache and the server stops doing the work required to service your subscription. If you forget to call stop, you'll consume unnecessary resources both on the client and the server.

However, if you call Meteor.subscribe() conditionally inside a reactive context (such as an autorun, or getMeteorData in React) or via this.subscribe() in a Blaze component, then Meteor's reactive system will automatically call this.stop() for you at the appropriate time.

## Subscribe in UI components

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

## Fetching data

Subscribing to data puts it in your client-side collection. To use the data in your user interface, you need to query your client-side collection. There are a couple of important rules to follow when doing this.

*Always use specific queries to fetch data*

If you're publishing a subset of your data, it might be tempting to simply query for all data available in a collection (i.e. Lists.find()) in order to get that subset on the client, without re-specifying the Mongo selector you used to publish that data in the first place.

But if you do this, then you open yourself up to problems if another subscription pushes data into the same collection, since the data returned by Lists.find() might not be what you expected anymore. In an actively developed application, it's often hard to anticipate what may change in the future and this can be a source of hard to understand bugs.

Also, when changing between subscriptions, there is a brief period where both subscriptions are loaded (see Publication behavior when changing arguments below), so when doing things like pagination, it's exceedingly likely that this will be the case.

*Fetch the data nearby where you subscribed to it*

We do this for the same reason we subscribe in the component in the first place---to avoid action at a distance and to make it easier to understand where data comes from. A common pattern is to fetch the data in a parent template, and then pass it into a "pure" child component, as we'll see it in the UI Article.

Note that there are some exceptions to this second rule. A common one is Meteor.user()---although this is strictly speaking subscribed to (automatically usually), it's typically over-complicated to pass it through the component hierarchy as an argument to each component. However keep in mind it's best not to use it in too many places as it makes components harder to test.

# Global subscriptions

One place where you might be tempted to not subscribe inside a component is when it accesses data that you know you always need. For instance, a subscription to extra fields on the user object (see the Accounts Article) that you need on every screen of your app.

However, it's generally a good idea to use a layout component (which you wrap all your components in) to subscribe to this subscription anyway. It's better to be consistent about such things, and it makes for a more flexible system if you ever decide you have a screen that doesn't need that data.

# Subscription readiness

It is key to understand that a subscription will not instantly provide its data. There will be a latency between subscribing to the data on the client and it arriving from the publication on the server. You should also be aware that this delay may be a lot longer for your users in production than for you locally in development!

Although the Tracker system means you often don't need to think too much about this in building your apps, usually if you want to get the user experience right, you'll need to know when the data is ready.

To find that out, Meteor.subscribe() and (this.subscribe() in Blaze components) returns a "subscription handle", which contains a reactive data source called .ready():
```
const handle = Meteor.subscribe('lists.public');
Tracker.autorun(() => {
  const isReady = handle.ready();
  console.log(`Handle is ${isReady ? 'ready' : 'not ready'}`);  
});
```
We can use this information to be more subtle about when we try and show data to users, and when we show a loading screen.

Reactively changing subscription arguments

We've already seen an example of using an autorun to re-subscribe when the (reactive) arguments to a subscription change. It's worth digging in a little more detail to understand what happens in this scenario.
```
Template.Lists_show_page.onCreated(function() {
  this.getListId = () => FlowRouter.getParam('_id');

  this.autorun(() => {
    this.subscribe('todos.inList', this.getListId());
  });
});
```
In our example, the autorun will re-run whenever this.getListId() changes, (ultimately because FlowRouter.getParam('_id') changes), although other common reactive data sources are:

Template data contexts (which you can access reactively with Template.currentData()).
The current user status (Meteor.user() and Meteor.loggingIn()).
The contents of other application specific client data stores.
Technically, what happens when one of these reactive sources changes is the following:

The reactive data source invalidates the autorun computation (marks it so that it re-runs in the next Tracker flush cycle).
The subscription detects this, and given that anything is possible in next computation run, marks itself for destruction.
The computation re-runs, with .subscribe() being re-called either with the same or different arguments.
If the subscription is run with the same arguments then the "new" subscription discovers the old "marked for destruction" subscription that's sitting around, with the same data already ready, and simply reuses that.
If the subscription is run with different arguments, then a new subscription is created, which connects to the publication on the server.
At the end of the flush cycle (i.e. after the computation is done re-running), the old subscription checks to see if it was re-used, and if not, sends a message to the server to tell the server to shut it down.
Step 4 above is an important detail---that the system cleverly knows not to re-subscribe if the autorun re-runs and subscribes with the exact same arguments. This holds true even if the new subscription is set up somewhere else in the template hierarchy. For example, if a user navigates between two pages that both subscribe to the exact same subscription, the same mechanism will kick in and no unnecessary subscribing will happen.

# Publication behavior when arguments change

It's also worth knowing a little about what happens on the server when the new subscription is started and the old one is stopped.

The server explicitly waits until all the data is sent down (the new subscription is ready) for the new subscription before removing the data from the old subscription. The idea here is to avoid flicker---you can, if desired, continue to show the old subscription's data until the new data is ready, then instantly switch over to the new subscription's complete data set.

What this means is in general, when changing subscriptions, there'll be a period where you are over-subscribed and there is more data on the client than you strictly asked for. This is one very important reason why you should always fetch the same data that you have subscribed to (don't "over-fetch").

# Paginating subscriptions

A very common pattern of data access is pagination. This refers to the practice of fetching an ordered list of data one "page" at a time---typically some number of items, say twenty.

There are two styles of pagination that are commonly used, a "page-by-page" style---where you show only one page of results at a time, starting at some offset (which the user can control), and "infinite-scroll" style, where you show an increasing number of pages of items, as the user moves through the list (this is the typical "feed" style user interface).

In this section, we'll consider a publication/subscription technique for the second, infinite-scroll style pagination. The page-by-page technique is a little tricker to handle in Meteor, due to it being difficult to calculate the offset on the client. If you need to do so, you can follow many of the same techniques that we use here and use the percolate:find-from-publication package to keep track of which records have come from your publication.

In an infinite scroll publication, we simply need to add a new argument to our publication controlling how many items to load. Suppose we wanted to paginate the todo items in our Todos example app:

```
const MAX_TODOS = 1000;

Meteor.publish('todos.inList', function(listId, limit) {
  new SimpleSchema({
    listId: { type: String },
    limit: { type: Number }
  }).validate({ listId, limit });

  const options = {
    sort: {createdAt: -1},
    limit: Math.min(limit, MAX_TODOS)
  };

  // ...
});
```
It's important that we set a sort parameter on our query (to ensure a repeatable order of list items as more pages are requested), and that we set an absolute maximum on the number of items a user can request (at least in the case where lists can grow without bound).

Then on the client side, we'd set some kind of reactive state variable to control how many items to request:
```
Template.Lists_show_page.onCreated(function() {
  this.getListId = () => FlowRouter.getParam('_id');

  this.autorun(() => {
    this.subscribe('todos.inList',
      this.getListId(), this.state.get('requestedTodos'));
  });
});
```
We'd increment that requestedTodos variable when the user clicks "load more" (or perhaps just when they scroll to the bottom of the page).

One piece of information that's very useful to know when paginating data is the total number of items that you could see. The tmeasday:publish-counts package can be useful to publish this. We could add a Lists.todoCount publication like so
```
Meteor.publish('Lists.todoCount', function({ listId }) {
  new SimpleSchema({
    listId: {type: String}
  }).validate({ listId });

  Counts.publish(this, `Lists.todoCount.${listId}`, Todos.find({listId}));
});
```
Then on the client, after subscribing to that publication, we can access the count with

```
Counts.get(`Lists.todoCount.${listId}`)
```

# Install y Ejecute demo
Primero deben ubicarse dentro de la carpeta del proyecto: whatsapp/ y ejecutar los siguientes comandos
```

meteor npm install
meteor run --settings settings.json

```


# References

* https://www.meteor.com/
* https://guide.meteor.com/collections.html (collections)
* https://guide.meteor.com/methods.html 
* https://guide.meteor.com/data-loading.html 
* https://github.com/meteor/guide/blob/master/content/data-loading.md 
* https://guide.meteor.com/accounts.html#userid-ddp 
