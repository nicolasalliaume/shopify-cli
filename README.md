# Shopify CLI Utility ( "The Wordpress CLI for Shopify" )
Shopify CLI is a command Line utility to perform operations on Shopify stores. It makes doing some typical operations on a store much easier, specially if you're doing dev work.

# ⓵ Installation

## Install using NPM
Run `npm install -g shopify-cli` to install globally.

## Install from source code
Clone this repo with `git clone https://github.com/nicolasalliaume/shopify-cli` and run `$ ./cli.js`

# ⓶ Configure authentication to a Shopify store
In order to run the commands, the CLI needs access to your Shopify store. For that, a private app is used.
If you've used the Theme Dev Toolkit for Shopify, you've probably done this before.

## Create a private app
You need to create a private app to get a key and a password that the CLI will use to connect to your store when you run a command.
Log into your Shopify admin page, go to **_Apps_**, scroll down, and click on the link that says _'Manage private apps'_. 
Then, click on _'Create a new private app'_. Give it a name, and fill in your email too. Finally, enable the following permissions:

	- Products, variants and collections: **'Read and write'**
	- Theme templates and theme assets: **'Read and write'**
	- Orders, transactions and fulfillments: **'Read and write'**

Save the app and copy the **_'API key'_** and **_'Password'_**. Then, open the terminal and...

## Run the config command to save your auth
Run `$ shopify-cli config -d <domain> -k <api key> -p <api password>`, where domain is the shop's Shopify domain (for example, '_mystore.myshopify.com_'). 
This will save in a local file your API key and Password, so you don't have to input them every time you run a command.

# Operations supported (_so far_)
Right now, the CLI is supporting the following operations:

## Themes

#### List themes `$ shopify-cli themes list`
This command will return a list of all the themes, indicating the active one. It also includes created time, updated time and ID.

Example: `$ shopify-cli themes list`

#### Remove themes `$ shopify-cli themes remove <id> [ <id> <id> ... ]`
This command will remove the indicated theme (or themes if more than one is indicated).

Example: `$ shopify-cli themes remove 231761231`

#### Activate theme `$ shopify-cli themes activate <id>`
This command activates the theme with the given ID.

Example: `$ shopify-cli themes activate 231761231`

#### Rename theme `$ shopify-cli themes rename <id> "New name"`
Renames the theme with the given ID, setting the given name. The new name accepts variables. The available variables are:
- %name%: The old name of the theme
- %id%: The id of the theme

Example: `$ shopify-cli themes rename 231761231 "Former %name%"` will rename a theme called "Debut" into "Former Debut".

#### Duplicate theme `$ shopify-cli themes duplicate <id> [ --name "New theme name" ]`
This command creates a copy of the theme with the given ID. Escentially, it creates a new theme (with provided name, if any), and copy every asset from the source theme into the new theme.

Example: `$ shopify-cli themes duplicate 231761231 --name "Duplicate of Debut"`

#### Sync themes `$ shopify-cli themes sync <id origin> <id target> [ <file 1> <file 2> ... ]`
Copies assets from the source theme into the target theme. All assets will be copied, unless a list of files is provided.

Example: `$ shopify-cli themes sync 231761231 1127862138 templates/cart.liquid templates/404.liquid assets/main.js`
