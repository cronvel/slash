/*
	Next Gen Shell
	
	Copyright (c) 2017 Cédric Ronvel
	
	The MIT License (MIT)
	
	Permission is hereby granted, free of charge, to any person obtaining a copy
	of this software and associated documentation files (the "Software"), to deal
	in the Software without restriction, including without limitation the rights
	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	copies of the Software, and to permit persons to whom the Software is
	furnished to do so, subject to the following conditions:
	
	The above copyright notice and this permission notice shall be included in all
	copies or substantial portions of the Software.
	
	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
	SOFTWARE.
*/

"use strict" ;



var Ngsh = require( './Ngsh.js' ) ;

var fs = require( 'fs' ) ;
var path = require( 'path' ) ;
var exec = require( 'child_process' ).exec ;

var async = require( 'async-kit' ) ;
//var tree = require( 'tree-kit' ) ;
//var string = require( 'string-kit' ) ;
var term = require( 'terminal-kit' ).terminal ;

var ngshPackage = require( '../package.json' ) ;



function cli( type )
{
	term.bold.magenta( 'ngsh' ).dim( ' v%s by Cédric Ronvel\n' , ngshPackage.version ) ;
	
	// Manage uncaughtException
	process.on( 'uncaughtException' , function( error ) {
		term.red( "uncaughtException: %E" , error ) ;
		throw error ;
	} ) ;
	
	// Manage command line arguments
	var args = require( 'minimist' )( process.argv.slice( 2 ) ) ;
	
	if ( args.h || args.help )
	{
		cli.usage( false , type ) ;
		return cli.exit( 0 ) ;
	}
	
	var ngsh = Ngsh.create() ;
	
	ngsh.init( () => {
		ngsh.run( () => {
			cli.exit() ;
		} ) ;
	} ) ;
}

module.exports = cli ;



cli.usage = function usage( noBaseline , type )
{
	term.blue( 'Usage is: ' ).cyan( 'ngsh [option1] [option2] [...]\n\n' ) ;
	term.blue( "Available options:\n" ) ;
	term.blue( "  --help , -h                Show this help\n" ) ;
} ;



cli.exit = function exit( code )
{
	async.exit( code , 1000 ) ;
} ;


