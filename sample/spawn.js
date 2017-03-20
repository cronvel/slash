#!/usr/bin/env node

"use strict" ;

var spawn = require( 'child_process' ).spawn ;
var termkit = require( 'terminal-kit' ) ;
var term = termkit.terminal ;

var triggered = false ;

var triggerCallback = ( error , code , signal ) => {
	
	if ( triggered ) { return ; }
	triggered = true ;
	
	child.removeListener( 'error' , onError ) ;
	child.removeListener( 'exit' , onExit ) ;
	
	if ( error ) { console.log( error ) ; }
	
	//process.stdin.setRawMode( false ) ;
	process.exit() ;
} ;

var onError = error => {
	triggerCallback( error ) ;
} ;

var onExit = ( code , signal ) => {
	triggerCallback( null , code , signal ) ;
} ;

/*
process.stdin.setRawMode( true ) ;
process.stdin.setRawMode( false ) ;
//*/

/*
var onStdin = data => { console.log( "\nGot data!" + data + "\n" ) ; } ;
process.stdin.on( 'data' , onStdin ) ;
process.stdin.removeListener( 'data' , onStdin ) ;
process.stdin.pause() ;
//*/

//*
term.grabInput( true ) ;
term.grabInput( false ) ;
//*/

var child = spawn( process.argv[ 2 ] , process.argv.slice( 3 ) , {
	cwd: process.cwd() ,
	env: process.env ,
	shell: false ,
	stdio: 'inherit'
} ) ;


child.on( 'error' , onError ) ;
child.on( 'exit' , onExit ) ;
